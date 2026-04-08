import express from 'express';
import {
  getNotifications,
  getNotificationStatsHandler,
  retryNotification,
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/stats', getNotificationStatsHandler);
router.get('/', getNotifications);
router.post('/:id/retry', retryNotification);

export default router;
