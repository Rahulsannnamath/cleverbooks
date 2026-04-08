import { Queue } from 'bullmq';

// Redis connection config
const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

// Queue names
export const QUEUE_NAMES = {
  DISCREPANCY: 'discrepancy-notifications',
  DEAD_LETTER: 'dead-letter-notifications',
};

// Lazy-initialized queues — only created when Redis is actually needed
let _discrepancyQueue = null;
let _deadLetterQueue = null;
let _redisAvailable = null; // null = unknown, true/false = tested

/**
 * Check if Redis is reachable before creating queues.
 */
async function checkRedis() {
  if (_redisAvailable !== null) return _redisAvailable;
  try {
    const net = await import('net');
    return new Promise((resolve) => {
      const socket = net.default.createConnection(redisConnection.port, redisConnection.host);
      socket.setTimeout(1500);
      socket.on('connect', () => { socket.destroy(); _redisAvailable = true; resolve(true); });
      socket.on('timeout', () => { socket.destroy(); _redisAvailable = false; resolve(false); });
      socket.on('error', () => { socket.destroy(); _redisAvailable = false; resolve(false); });
    });
  } catch {
    _redisAvailable = false;
    return false;
  }
}

export function getDiscrepancyQueue() {
  if (!_discrepancyQueue) {
    _discrepancyQueue = new Queue(QUEUE_NAMES.DISCREPANCY, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000, // starts at 2s, then 4s, 8s, 16s, 32s
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return _discrepancyQueue;
}

export function getDeadLetterQueue() {
  if (!_deadLetterQueue) {
    _deadLetterQueue = new Queue(QUEUE_NAMES.DEAD_LETTER, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: { count: 500 },
      },
    });
  }
  return _deadLetterQueue;
}

/**
 * Publish a discrepancy event to the queue.
 * This is called by the reconciliation engine, NOT by the notification sender directly.
 * Gracefully degrades if Redis is not available.
 */
export const publishDiscrepancyEvent = async (eventData) => {
  const redisUp = await checkRedis();
  if (!redisUp) {
    console.warn(`⚠️ Redis unavailable — skipping queue publish for AWB ${eventData.awbNumber}. Notifications will not be sent until Redis is running.`);
    return;
  }

  const { settlementId, awbNumber, merchantId, discrepancies } = eventData;
  const queue = getDiscrepancyQueue();

  for (const discrepancy of discrepancies) {
    const idempotencyKey = `${awbNumber}:${discrepancy.rule}:${settlementId}`;

    await queue.add(
      'notify-discrepancy',
      {
        settlementId,
        awbNumber,
        merchantId,
        discrepancyType: discrepancy.rule,
        expected: discrepancy.expected,
        actual: discrepancy.actual,
        description: discrepancy.description,
        idempotencyKey,
      },
      {
        jobId: idempotencyKey, // BullMQ deduplication
      }
    );
  }
};

export { redisConnection, checkRedis };
