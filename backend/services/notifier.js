import Notification from '../models/Notification.js';

/**
 * Notifier service — used as a fallback/utility
 * The actual notification sending happens in the Worker (workers/notificationWorker.js)
 * This service provides helper methods for notification management.
 */

/**
 * Get notification stats
 */
export async function getNotificationStats() {
  const stats = await Notification.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    total: 0,
    sent: 0,
    failed: 0,
    queued: 0,
    retrying: 0,
    deadLetter: 0,
  };

  stats.forEach((s) => {
    result.total += s.count;
    switch (s._id) {
      case 'SENT':
        result.sent = s.count;
        break;
      case 'FAILED':
        result.failed = s.count;
        break;
      case 'QUEUED':
        result.queued = s.count;
        break;
      case 'RETRYING':
        result.retrying = s.count;
        break;
      case 'DEAD_LETTER':
        result.deadLetter = s.count;
        break;
    }
  });

  return result;
}

/**
 * Retry a dead-letter notification manually
 */
export async function retryDeadLetterNotification(notificationId) {
  const notification = await Notification.findById(notificationId);
  if (!notification || notification.status !== 'DEAD_LETTER') {
    throw new Error('Notification not found or not in dead-letter state');
  }

  notification.status = 'QUEUED';
  notification.attempts = 0;
  notification.errorMessage = null;
  await notification.save();

  // Re-publish to queue
  const { getDiscrepancyQueue } = await import('../config/queue.js');
  const queue = getDiscrepancyQueue();
  await queue.add(
    'notify-discrepancy',
    {
      settlementId: notification.settlementId.toString(),
      awbNumber: notification.awbNumber,
      merchantId: notification.merchantId,
      discrepancyType: notification.discrepancyType,
      expected: notification.payload.expectedValue,
      actual: notification.payload.actualValue,
      description: notification.payload.description,
      idempotencyKey: notification.idempotencyKey + ':retry:' + Date.now(),
    }
  );

  return notification;
}
