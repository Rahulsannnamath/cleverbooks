import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';
import Settlement from '../models/Settlement.js';
import Job from '../models/Job.js';
import Notification from '../models/Notification.js';

dotenv.config();

/**
 * Seed Data Generator
 * 
 * Generates 50+ mock orders and 1 settlement batch with intentional discrepancies
 * covering all 5 detection rules for review/demo purposes.
 * 
 * Usage: node utils/seedData.js
 */

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const courierPartners = ['shiprocket', 'delhivery', 'bluedart', 'dtdc', 'kwikship', 'ecom_express'];
const merchants = ['MERCH_001', 'MERCH_002', 'MERCH_003', 'MERCH_004', 'MERCH_005'];

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function generateAWB(index) {
  return `AWB${String(index).padStart(8, '0')}`;
}

// ──────────────────────────────────────────────
// Generate Orders
// ──────────────────────────────────────────────

function generateOrders() {
  const orders = [];

  for (let i = 1; i <= 55; i++) {
    const awb = generateAWB(i);
    const isDelivered = i <= 40; // 40 delivered, 10 RTO, 3 in transit, 2 lost
    const isRTO = i > 40 && i <= 50;
    const isInTransit = i > 50 && i <= 53;
    const isLost = i > 53;

    let orderStatus, deliveryDate;
    if (isDelivered) {
      orderStatus = 'DELIVERED';
      // Mix of recent and older deliveries
      deliveryDate = daysAgo(randomInt(3, 30));
    } else if (isRTO) {
      orderStatus = 'RTO';
      deliveryDate = null;
    } else if (isInTransit) {
      orderStatus = 'IN_TRANSIT';
      deliveryDate = null;
    } else {
      orderStatus = 'LOST';
      deliveryDate = null;
    }

    const codAmount = i % 5 === 0 ? 0 : randomFloat(200, 5000); // Every 5th order is prepaid

    orders.push({
      awbNumber: awb,
      merchantId: randomElement(merchants),
      courierPartner: randomElement(courierPartners),
      orderStatus,
      codAmount,
      declaredWeight: randomFloat(0.3, 10, 1),
      orderDate: daysAgo(randomInt(20, 60)),
      deliveryDate,
    });
  }

  return orders;
}

// ──────────────────────────────────────────────
// Generate Settlements with intentional discrepancies
// ──────────────────────────────────────────────

function generateSettlements(orders) {
  const settlements = [];
  const batchId = 'BATCH_SEED_001';

  // Generate settlements for the first 45 orders
  for (let i = 0; i < 45; i++) {
    const order = orders[i];
    const settlement = {
      awbNumber: order.awbNumber,
      batchId,
      settlementDate: new Date(),
      forwardCharge: randomFloat(30, 200),
      rtoCharge: 0,
      codHandlingFee: order.codAmount > 0 ? randomFloat(5, 50) : 0,
      // defaults — will be modified for discrepancies below
      settledCodAmount: order.codAmount,
      chargedWeight: order.declaredWeight,
    };

    // ────── Intentional discrepancies ──────

    // Rule 1: COD Short-remittance (orders 1-5)
    if (i < 5 && order.codAmount > 0) {
      // Remit significantly less than expected (beyond tolerance)
      settlement.settledCodAmount = order.codAmount - randomFloat(50, 500);
      if (settlement.settledCodAmount < 0) settlement.settledCodAmount = 0;
    }

    // Rule 2: Weight Dispute (orders 6-10)
    if (i >= 5 && i < 10) {
      // Charge weight > 110% of declared
      settlement.chargedWeight = parseFloat((order.declaredWeight * randomFloat(1.15, 1.8)).toFixed(1));
    }

    // Rule 3: Phantom RTO Charge (orders 11-15, which are DELIVERED)
    if (i >= 10 && i < 15 && order.orderStatus === 'DELIVERED') {
      settlement.rtoCharge = randomFloat(50, 200);
    }

    // Rule 4: Overdue Remittance (orders 16-20)
    // For these, we set a delivery date > 14 days ago and NO settlement date
    if (i >= 15 && i < 20 && order.orderStatus === 'DELIVERED') {
      // Modify the order to have delivery date > 14 days ago
      orders[i].deliveryDate = daysAgo(randomInt(18, 30));
      settlement.settlementDate = null; // No settlement date
    }

    // Rule 5: Duplicate Settlement — we'll add a duplicate for AWB00000001 in a second batch later

    settlements.push(settlement);
  }

  // Add 3 more settlements for RTO orders (orders 41-43), with 0 COD
  for (let i = 40; i < 43; i++) {
    const order = orders[i];
    settlements.push({
      awbNumber: order.awbNumber,
      batchId,
      settledCodAmount: 0,
      chargedWeight: order.declaredWeight,
      forwardCharge: randomFloat(30, 100),
      rtoCharge: randomFloat(50, 150), // Legitimate RTO charge for RTO orders
      codHandlingFee: 0,
      settlementDate: new Date(),
    });
  }

  return settlements;
}

// ──────────────────────────────────────────────
// Generate duplicate settlement batch (for Rule 5)
// ──────────────────────────────────────────────

function generateDuplicateBatch(orders) {
  return [
    {
      awbNumber: orders[0].awbNumber, // AWB00000001 — duplicate
      batchId: 'BATCH_SEED_002',
      settledCodAmount: orders[0].codAmount,
      chargedWeight: orders[0].declaredWeight,
      forwardCharge: randomFloat(30, 100),
      rtoCharge: 0,
      codHandlingFee: orders[0].codAmount > 0 ? randomFloat(5, 50) : 0,
      settlementDate: new Date(),
    },
    {
      awbNumber: orders[1].awbNumber, // AWB00000002 — duplicate
      batchId: 'BATCH_SEED_002',
      settledCodAmount: orders[1].codAmount,
      chargedWeight: orders[1].declaredWeight,
      forwardCharge: randomFloat(30, 100),
      rtoCharge: 0,
      codHandlingFee: orders[1].codAmount > 0 ? randomFloat(5, 50) : 0,
      settlementDate: new Date(),
    },
  ];
}

// ──────────────────────────────────────────────
// Main Seed Function
// ──────────────────────────────────────────────

async function seedDatabase() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await Promise.all([
      Order.deleteMany({}),
      Settlement.deleteMany({}),
      Job.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Generate and insert orders
    console.log('📦 Generating 55 mock orders...');
    const orders = generateOrders();
    await Order.insertMany(orders);
    console.log(`✅ Inserted ${orders.length} orders`);

    // Generate and insert main settlement batch
    console.log('💰 Generating settlement batch with intentional discrepancies...');
    const settlements = generateSettlements(orders);
    await Settlement.insertMany(settlements);
    console.log(`✅ Inserted ${settlements.length} settlement records (Batch: BATCH_SEED_001)`);

    // Generate and insert duplicate batch (for Rule 5)
    console.log('📋 Generating duplicate batch for Rule 5 testing...');
    const duplicates = generateDuplicateBatch(orders);
    await Settlement.insertMany(duplicates);
    console.log(`✅ Inserted ${duplicates.length} duplicate settlement records (Batch: BATCH_SEED_002)`);

    // Summary
    console.log('\n──────────────────────────────────────');
    console.log('🎯 SEED DATA SUMMARY');
    console.log('──────────────────────────────────────');
    console.log(`   Orders:                    ${orders.length}`);
    console.log(`   Settlements (Batch 1):     ${settlements.length}`);
    console.log(`   Settlements (Batch 2):     ${duplicates.length} (duplicates for Rule 5)`);
    console.log(`   Total Settlements:         ${settlements.length + duplicates.length}`);
    console.log('');
    console.log('   🔴 Intentional Discrepancies:');
    console.log('     Rule 1 (COD Short):      AWB00000001 – AWB00000005');
    console.log('     Rule 2 (Weight):         AWB00000006 – AWB00000010');
    console.log('     Rule 3 (Phantom RTO):    AWB00000011 – AWB00000015');
    console.log('     Rule 4 (Overdue):        AWB00000016 – AWB00000020');
    console.log('     Rule 5 (Duplicate):      AWB00000001, AWB00000002');
    console.log('──────────────────────────────────────\n');

    console.log('✅ Seed data generated successfully!');
    console.log('   Run the reconciliation to detect discrepancies:');
    console.log('   POST http://localhost:5000/api/jobs/trigger\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Seed error: ${error.message}`);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedDatabase();
