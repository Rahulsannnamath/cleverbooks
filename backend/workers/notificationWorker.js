import { Worker } from 'bullmq';
import Notification from '../models/Notification.js';
import { QUEUE_NAMES, getDeadLetterQueue, redisConnection, checkRedis } from '../config/queue.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://eowfw1pta25ghwn.m.pipedream.net';

/**
 * Notification Worker
 * 
 * Consumes discrepancy events from the BullMQ queue and sends notifications
 * to the merchant via Pipedream (or any configured external API).
 * 
 * Features:
 *   - Retry with exponential backoff (configured in queue)
 *   - Dead-letter queue for permanently failed notifications
 *   - Idempotency key to prevent duplicate notifications
 */

async function sendNotification(data) {
  const {
    settlementId,
    awbNumber,
    merchantId,
    discrepancyType,
    expected,
    actual,
    description,
    idempotencyKey,
  } = data;

  // Check idempotency — skip if already sent
  const existing = await Notification.findOne({
    idempotencyKey,
    status: 'SENT',
  });

  if (existing) {
    console.log(`⏭️ Notification already sent for ${idempotencyKey}, skipping`);
    return { skipped: true };
  }

  // Determine suggested action based on discrepancy type
  const suggestedActions = {
    COD_SHORT_REMITTANCE: 'Raise a dispute with the courier for the short-remitted COD amount',
    WEIGHT_DISPUTE: 'Submit proof of actual weight (photos/weighing slip) to courier partner',
    PHANTOM_RTO_CHARGE: 'Dispute the RTO charge — order was marked as DELIVERED',
    OVERDUE_REMITTANCE: 'Follow up with courier partner for pending remittance settlement',
    DUPLICATE_SETTLEMENT: 'Review and verify which settlement record is accurate',
  };

  const payload = {
    merchantId,
    awbNumber,
    discrepancyType,
    expectedValue: expected,
    actualValue: actual,
    description,
    suggestedAction: suggestedActions[discrepancyType] || 'Review and resolve the discrepancy',
    timestamp: new Date().toISOString(),
  };

  // Create or update notification record
  let notification = await Notification.findOne({ idempotencyKey });

  if (!notification) {
    notification = new Notification({
      settlementId,
      awbNumber,
      merchantId,
      discrepancyType,
      payload,
      status: 'QUEUED',
      idempotencyKey,
    });
    await notification.save();
  }

  // Send to Pipedream
  try {
    notification.attempts += 1;
    notification.lastAttemptAt = new Date();
    notification.status = 'RETRYING';
    await notification.save();

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with status ${response.status}`);
    }

    // Success — save response info
    notification.status = 'SENT';
    notification.sentAt = new Date();
    notification.externalResponse = {
      status: response.status,
      statusText: response.statusText,
    };
    await notification.save();

    console.log(`✅ Notification sent for AWB ${awbNumber} (${discrepancyType})`);
    return { success: true };
  } catch (error) {
    notification.errorMessage = error.message;
    await notification.save();
    throw error; // Re-throw so BullMQ handles the retry
  }
}

/**
 * Start the notification worker.
 * Called during server startup. Only starts if Redis is available.
 */
export async function startNotificationWorker() {
  const redisUp = await checkRedis();
  if (!redisUp) {
    console.warn('⚠️  Redis not available — notification worker NOT started.');
    console.warn('   Reconciliation will still work, but notifications won\'t be sent via queue.');
    console.warn('   Start Redis and restart the server to enable the notification worker.');
    return null;
  }

  const worker = new Worker(
    QUEUE_NAMES.DISCREPANCY,
    async (job) => {
      console.log(`📧 Processing notification job: ${job.id}`);
      return await sendNotification(job.data);
    },
    {
      connection: redisConnection,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 1000, // max 10 notifications per second
      },
    }
  );

  // Handle completed jobs
  worker.on('completed', (job) => {
    console.log(`✅ Notification job ${job.id} completed`);
  });

  // Handle failed jobs (after all retries)
  worker.on('failed', async (job, error) => {
    console.error(`❌ Notification job ${job.id} permanently failed: ${error.message}`);

    // Move to dead-letter queue
    try {
      const dlq = getDeadLetterQueue();
      await dlq.add('dead-letter', {
        ...job.data,
        originalJobId: job.id,
        failureReason: error.message,
        failedAt: new Date().toISOString(),
      });

      // Update notification status to DEAD_LETTER
      await Notification.findOneAndUpdate(
        { idempotencyKey: job.data.idempotencyKey },
        {
          status: 'DEAD_LETTER',
          errorMessage: `Permanently failed after ${job.attemptsMade} attempts: ${error.message}`,
        }
      );

      console.log(`💀 Job ${job.id} moved to dead-letter queue`);
    } catch (dlqError) {
      console.error(`❌ Failed to move job to DLQ: ${dlqError.message}`);
    }
  });

  // Handle worker-level errors (suppress repetitive Redis errors)
  let errorCount = 0;
  worker.on('error', (error) => {
    errorCount++;
    if (errorCount <= 3) {
      console.error(`❌ Worker error: ${error.message}`);
    }
    if (errorCount === 3) {
      console.error('   (Suppressing further repeated worker errors)');
    }
  });

  console.log('🔄 Notification worker started (Redis connected)');
  return worker;
}
