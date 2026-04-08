import Notification from '../models/Notification.js';
import { getNotificationStats, retryDeadLetterNotification } from '../services/notifier.js';

/**
 * Notification Controller
 * Handles notification delivery logs and management.
 */

/**
 * GET /api/notifications
 * List notification delivery logs with optional status filter
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status.toUpperCase();

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Notification.countDocuments(filter);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/stats
 * Get notification delivery statistics
 */
export const getNotificationStatsHandler = async (req, res, next) => {
  try {
    const stats = await getNotificationStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/notifications/:id/retry
 * Retry a dead-letter notification
 */
export const retryNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await retryDeadLetterNotification(id);
    res.json({
      success: true,
      message: 'Notification re-queued successfully',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};
