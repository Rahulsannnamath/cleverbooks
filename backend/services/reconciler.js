import Order from '../models/Order.js';
import Settlement from '../models/Settlement.js';
import Job from '../models/Job.js';
import { publishDiscrepancyEvent } from '../config/queue.js';

/**
 * Reconciliation Engine
 * 
 * Compares each courier settlement record against the corresponding order record.
 * Implements all 5 discrepancy detection rules:
 *   1. COD Short-remittance
 *   2. Weight Dispute
 *   3. Phantom RTO Charge
 *   4. Overdue Remittance
 *   5. Duplicate Settlement
 */

// ──────────────────────────────────────────────
// Discrepancy Detection Rules
// ──────────────────────────────────────────────

/**
 * Rule 1: COD Short-remittance
 * settledCodAmount < codAmount − tolerance
 * tolerance = min(2% of codAmount, ₹10)
 */
function checkCodShortRemittance(settlement, order) {
  if (order.codAmount === 0) return null; // Prepaid order, skip

  const tolerance = Math.min(order.codAmount * 0.02, 10);
  const expectedMin = order.codAmount - tolerance;

  if (settlement.settledCodAmount < expectedMin) {
    return {
      rule: 'COD_SHORT_REMITTANCE',
      expected: order.codAmount,
      actual: settlement.settledCodAmount,
      description: `COD short-remittance of ₹${(order.codAmount - settlement.settledCodAmount).toFixed(2)}. Expected ≥ ₹${expectedMin.toFixed(2)}, got ₹${settlement.settledCodAmount.toFixed(2)}`,
    };
  }
  return null;
}

/**
 * Rule 2: Weight Dispute
 * chargedWeight > declaredWeight × 1.10 (more than 10% over declared)
 */
function checkWeightDispute(settlement, order) {
  const maxAllowedWeight = order.declaredWeight * 1.10;

  if (settlement.chargedWeight > maxAllowedWeight) {
    return {
      rule: 'WEIGHT_DISPUTE',
      expected: order.declaredWeight,
      actual: settlement.chargedWeight,
      description: `Weight dispute: courier charged ${settlement.chargedWeight}kg but declared weight was ${order.declaredWeight}kg (max allowed: ${maxAllowedWeight.toFixed(2)}kg)`,
    };
  }
  return null;
}

/**
 * Rule 3: Phantom RTO Charge
 * rtoCharge > 0 but orderStatus = DELIVERED
 */
function checkPhantomRtoCharge(settlement, order) {
  if (settlement.rtoCharge > 0 && order.orderStatus === 'DELIVERED') {
    return {
      rule: 'PHANTOM_RTO_CHARGE',
      expected: 0,
      actual: settlement.rtoCharge,
      description: `Phantom RTO charge of ₹${settlement.rtoCharge.toFixed(2)} on a DELIVERED order`,
    };
  }
  return null;
}

/**
 * Rule 4: Overdue Remittance
 * deliveryDate is more than 14 days ago but no settlementDate exists
 */
function checkOverdueRemittance(settlement, order) {
  if (!order.deliveryDate) return null; // Not delivered yet

  const daysSinceDelivery = Math.floor(
    (Date.now() - new Date(order.deliveryDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceDelivery > 14 && !settlement.settlementDate) {
    return {
      rule: 'OVERDUE_REMITTANCE',
      expected: 'Settlement within 14 days',
      actual: `${daysSinceDelivery} days since delivery, no settlement`,
      description: `Overdue remittance: ${daysSinceDelivery} days since delivery (${new Date(order.deliveryDate).toISOString().split('T')[0]}) but no settlement date recorded`,
    };
  }
  return null;
}

/**
 * Rule 5: Duplicate Settlement
 * Same awbNumber appears in more than one settlement batch
 */
async function checkDuplicateSettlement(settlement) {
  const count = await Settlement.countDocuments({
    awbNumber: settlement.awbNumber,
    _id: { $ne: settlement._id },
  });

  if (count > 0) {
    return {
      rule: 'DUPLICATE_SETTLEMENT',
      expected: 1,
      actual: count + 1,
      description: `Duplicate settlement: AWB ${settlement.awbNumber} appears in ${count + 1} settlement records across different batches`,
    };
  }
  return null;
}

// ──────────────────────────────────────────────
// Main Reconciliation Runner
// ──────────────────────────────────────────────

/**
 * Run reconciliation on all PENDING settlement records.
 * @param {string} trigger - 'SCHEDULED' or 'MANUAL'
 * @returns {object} The completed Job document
 */
export async function runReconciliation(trigger = 'SCHEDULED') {
  // Create a job record
  const job = await Job.create({
    type: 'RECONCILIATION',
    status: 'RUNNING',
    trigger,
    startedAt: new Date(),
  });

  try {
    // Fetch all PENDING settlements
    const pendingSettlements = await Settlement.find({ status: 'PENDING' });

    let matchedCount = 0;
    let discrepancyCount = 0;
    let pendingReviewCount = 0;

    for (const settlement of pendingSettlements) {
      // Find the corresponding order
      const order = await Order.findOne({ awbNumber: settlement.awbNumber });

      if (!order) {
        // No matching order — mark as PENDING_REVIEW
        settlement.status = 'PENDING_REVIEW';
        settlement.discrepancies = [
          {
            rule: 'COD_SHORT_REMITTANCE', // placeholder rule
            expected: 'Matching order record',
            actual: 'No order found',
            description: `No order record found for AWB ${settlement.awbNumber}`,
          },
        ];
        settlement.reconciledAt = new Date();
        settlement.reconciledByJobId = job._id;
        await settlement.save();
        pendingReviewCount++;
        continue;
      }

      // Run all 5 discrepancy rules
      const discrepancies = [];

      const codCheck = checkCodShortRemittance(settlement, order);
      if (codCheck) discrepancies.push(codCheck);

      const weightCheck = checkWeightDispute(settlement, order);
      if (weightCheck) discrepancies.push(weightCheck);

      const rtoCheck = checkPhantomRtoCharge(settlement, order);
      if (rtoCheck) discrepancies.push(rtoCheck);

      const overdueCheck = checkOverdueRemittance(settlement, order);
      if (overdueCheck) discrepancies.push(overdueCheck);

      const duplicateCheck = await checkDuplicateSettlement(settlement);
      if (duplicateCheck) discrepancies.push(duplicateCheck);

      // Determine final status
      if (discrepancies.length > 0) {
        settlement.status = 'DISCREPANCY';
        settlement.discrepancies = discrepancies;
        discrepancyCount++;

        // Publish discrepancy event to queue (decoupled from notification)
        await publishDiscrepancyEvent({
          settlementId: settlement._id.toString(),
          awbNumber: settlement.awbNumber,
          merchantId: order.merchantId,
          discrepancies,
        });
      } else {
        settlement.status = 'MATCHED';
        matchedCount++;
      }

      settlement.reconciledAt = new Date();
      settlement.reconciledByJobId = job._id;
      await settlement.save();
    }

    // Update job as completed
    job.status = 'COMPLETED';
    job.totalRecords = pendingSettlements.length;
    job.matchedCount = matchedCount;
    job.discrepancyCount = discrepancyCount;
    job.pendingReviewCount = pendingReviewCount;
    job.completedAt = new Date();
    await job.save();

    console.log(
      `✅ Reconciliation completed: ${pendingSettlements.length} records processed, ` +
        `${matchedCount} matched, ${discrepancyCount} discrepancies, ${pendingReviewCount} pending review`
    );

    return job;
  } catch (error) {
    // Update job as failed
    job.status = 'FAILED';
    job.errorMessage = error.message;
    job.completedAt = new Date();
    await job.save();

    console.error(`❌ Reconciliation failed: ${error.message}`);
    throw error;
  }
}
