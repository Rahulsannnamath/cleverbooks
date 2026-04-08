import cron from 'node-cron';
import { runReconciliation } from '../services/reconciler.js';

/**
 * Scheduled Reconciliation Job
 * 
 * Runs nightly at a configurable time (default: 2:00 AM IST).
 * IST = UTC+5:30, so 2:00 AM IST = 20:30 UTC (previous day)
 * 
 * node-cron supports timezone option natively.
 */

let scheduledTask = null;

export function startScheduledReconciliation() {
  const cronExpression = process.env.RECONCILIATION_CRON || '0 2 * * *'; // Default: 2:00 AM daily
  const timezone = process.env.RECONCILIATION_TZ || 'Asia/Kolkata'; // IST

  scheduledTask = cron.schedule(
    cronExpression,
    async () => {
      console.log(`\n🕐 [${new Date().toISOString()}] Scheduled reconciliation started`);
      try {
        const job = await runReconciliation('SCHEDULED');
        console.log(`✅ Scheduled reconciliation completed: Job ${job._id}`);
      } catch (error) {
        console.error(`❌ Scheduled reconciliation failed: ${error.message}`);
      }
    },
    {
      timezone,
      scheduled: true,
    }
  );

  console.log(
    `📅 Reconciliation scheduled: "${cronExpression}" (${timezone})`
  );
}

export function stopScheduledReconciliation() {
  if (scheduledTask) {
    scheduledTask.stop();
    console.log('📅 Scheduled reconciliation stopped');
  }
}
