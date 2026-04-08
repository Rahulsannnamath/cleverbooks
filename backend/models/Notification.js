import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Settlement',
      required: true,
    },
    awbNumber: {
      type: String,
      required: true,
      index: true,
    },
    merchantId: {
      type: String,
      required: true,
    },
    discrepancyType: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Delivery status
    status: {
      type: String,
      required: true,
      enum: ['QUEUED', 'SENT', 'FAILED', 'RETRYING', 'DEAD_LETTER'],
      default: 'QUEUED',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    // Idempotency key to prevent duplicate notifications
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // External API response
    externalResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
