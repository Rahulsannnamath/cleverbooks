import Settlement from '../models/Settlement.js';
import Order from '../models/Order.js';
import { parseCSV, toCSV } from '../utils/csvParser.js';
import crypto from 'crypto';

/**
 * Settlement Controller
 * Handles CSV/JSON upload, listing, filtering, detail view, and export.
 */

/**
 * POST /api/settlements/upload
 * Ingest a batch of courier settlement records (CSV or JSON).
 * Idempotency: same batchId re-upload will not double-process.
 */
export const uploadSettlements = async (req, res, next) => {
  try {
    let records = [];
    let batchId = req.body.batchId;

    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data') || req.file) {
      // File upload (CSV)
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded. Upload a CSV file.',
        });
      }

      const csvText = req.file.buffer.toString('utf-8');
      records = parseCSV(csvText);
      batchId = batchId || `batch_${crypto.randomUUID()}`;
    } else if (contentType.includes('application/json')) {
      // JSON body upload
      records = req.body.records || req.body.settlements || [];
      batchId = batchId || req.body.batchId || `batch_${crypto.randomUUID()}`;

      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No records provided. Send an array of settlement records.',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported content type. Use application/json or multipart/form-data (CSV).',
      });
    }

    // Validate max rows
    if (records.length > 1000) {
      return res.status(400).json({
        success: false,
        error: `Maximum 1,000 records per batch. You sent ${records.length}.`,
      });
    }

    // Check for existing batch (idempotency)
    const existingBatch = await Settlement.findOne({ batchId });
    if (existingBatch) {
      return res.status(409).json({
        success: false,
        error: `Batch "${batchId}" has already been uploaded. Use a different batchId to upload new records.`,
        existingCount: await Settlement.countDocuments({ batchId }),
      });
    }

    // Prepare settlement documents
    const settlements = records.map((record) => ({
      awbNumber: record.awbNumber,
      settledCodAmount: parseFloat(record.settledCodAmount) || 0,
      chargedWeight: parseFloat(record.chargedWeight) || 0,
      forwardCharge: parseFloat(record.forwardCharge) || 0,
      rtoCharge: parseFloat(record.rtoCharge) || 0,
      codHandlingFee: parseFloat(record.codHandlingFee) || 0,
      settlementDate: record.settlementDate ? new Date(record.settlementDate) : null,
      batchId,
      status: 'PENDING',
    }));

    // Validate required fields
    const invalidRecords = [];
    settlements.forEach((s, idx) => {
      if (!s.awbNumber) {
        invalidRecords.push({ row: idx + 1, error: 'Missing awbNumber' });
      }
    });

    if (invalidRecords.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some records have validation errors',
        invalidRecords: invalidRecords.slice(0, 10), // Show first 10
        totalInvalid: invalidRecords.length,
      });
    }

    // Bulk insert with ordered: false to continue on duplicates
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    try {
      const result = await Settlement.insertMany(settlements, { ordered: false });
      inserted = result.length;
    } catch (error) {
      if (error.code === 11000 || error.writeErrors) {
        // Some duplicates — partial success
        inserted = error.insertedDocs?.length || settlements.length - (error.writeErrors?.length || 0);
        skipped = error.writeErrors?.length || 0;
        error.writeErrors?.forEach((we) => {
          errors.push({
            row: we.index + 1,
            error: 'Duplicate AWB number in this batch',
          });
        });
      } else {
        throw error;
      }
    }

    res.status(201).json({
      success: true,
      message: `Batch "${batchId}" uploaded successfully`,
      data: {
        batchId,
        totalRecords: records.length,
        inserted,
        skipped,
        errors: errors.slice(0, 10),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/settlements
 * List settlements with optional status filter and pagination.
 */
export const getSettlements = async (req, res, next) => {
  try {
    const {
      status,
      batchId,
      courierPartner,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter = {};
    if (status) filter.status = status.toUpperCase();
    if (batchId) filter.batchId = batchId;

    // If filtering by courierPartner, we need to join with orders
    let settlements;
    let total;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    if (courierPartner) {
      // Use aggregation to join with orders
      const pipeline = [
        {
          $lookup: {
            from: 'orders',
            localField: 'awbNumber',
            foreignField: 'awbNumber',
            as: 'order',
          },
        },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            ...filter,
            'order.courierPartner': courierPartner.toLowerCase(),
          },
        },
        { $sort: sort },
      ];

      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await Settlement.aggregate(countPipeline);
      total = countResult[0]?.total || 0;

      settlements = await Settlement.aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: parseInt(limit) },
      ]);
    } else {
      total = await Settlement.countDocuments(filter);
      settlements = await Settlement.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
    }

    // Enrich with order data if not already joined
    if (!courierPartner) {
      const awbNumbers = settlements.map((s) => s.awbNumber);
      const orders = await Order.find({ awbNumber: { $in: awbNumbers } }).lean();
      const orderMap = new Map(orders.map((o) => [o.awbNumber, o]));

      settlements = settlements.map((s) => ({
        ...s,
        order: orderMap.get(s.awbNumber) || null,
      }));
    }

    res.json({
      success: true,
      data: {
        settlements,
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
 * GET /api/settlements/:awbNumber
 * Get detailed view for a single settlement
 */
export const getSettlementDetail = async (req, res, next) => {
  try {
    const { awbNumber } = req.params;

    const settlement = await Settlement.findOne({ awbNumber }).lean();
    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: `Settlement not found for AWB: ${awbNumber}`,
      });
    }

    const order = await Order.findOne({ awbNumber }).lean();

    res.json({
      success: true,
      data: {
        settlement,
        order,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/settlements/stats/summary
 * Get summary statistics for dashboard cards
 */
export const getSettlementStats = async (req, res, next) => {
  try {
    // Status breakdown
    const statusStats = await Settlement.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Total discrepancy value (COD short-remittance amounts)
    const discrepancyValue = await Settlement.aggregate([
      { $match: { status: 'DISCREPANCY' } },
      {
        $lookup: {
          from: 'orders',
          localField: 'awbNumber',
          foreignField: 'awbNumber',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          variance: {
            $subtract: [
              { $ifNull: ['$order.codAmount', 0] },
              '$settledCodAmount',
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalDiscrepancyValue: {
            $sum: { $cond: [{ $gt: ['$variance', 0] }, '$variance', 0] },
          },
        },
      },
    ]);

    // Courier-level breakdown
    const courierBreakdown = await Settlement.aggregate([
      { $match: { status: 'DISCREPANCY' } },
      {
        $lookup: {
          from: 'orders',
          localField: 'awbNumber',
          foreignField: 'awbNumber',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$order.courierPartner',
          discrepancyCount: { $sum: 1 },
          totalVariance: {
            $sum: {
              $subtract: [
                { $ifNull: ['$order.codAmount', 0] },
                '$settledCodAmount',
              ],
            },
          },
        },
      },
      { $sort: { discrepancyCount: -1 } },
    ]);

    // Discrepancy type breakdown
    const discrepancyTypeBreakdown = await Settlement.aggregate([
      { $match: { status: 'DISCREPANCY' } },
      { $unwind: '$discrepancies' },
      {
        $group: {
          _id: '$discrepancies.rule',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const stats = {};
    statusStats.forEach((s) => {
      stats[s._id?.toLowerCase() || 'unknown'] = s.count;
    });

    res.json({
      success: true,
      data: {
        statusBreakdown: stats,
        totalRecords:
          (stats.pending || 0) +
          (stats.matched || 0) +
          (stats.discrepancy || 0) +
          (stats.pending_review || 0),
        totalDiscrepancyValue: discrepancyValue[0]?.totalDiscrepancyValue || 0,
        courierBreakdown,
        discrepancyTypeBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/settlements/export/csv
 * Export filtered settlements to CSV
 */
export const exportSettlementsCSV = async (req, res, next) => {
  try {
    const { status, batchId } = req.query;
    const filter = {};
    if (status) filter.status = status.toUpperCase();
    if (batchId) filter.batchId = batchId;

    const settlements = await Settlement.find(filter).lean();

    // Enrich with order data
    const awbNumbers = settlements.map((s) => s.awbNumber);
    const orders = await Order.find({ awbNumber: { $in: awbNumbers } }).lean();
    const orderMap = new Map(orders.map((o) => [o.awbNumber, o]));

    const csvRecords = settlements.map((s) => {
      const order = orderMap.get(s.awbNumber);
      return {
        awbNumber: s.awbNumber,
        batchId: s.batchId,
        status: s.status,
        settledCodAmount: s.settledCodAmount,
        expectedCodAmount: order?.codAmount || 'N/A',
        chargedWeight: s.chargedWeight,
        declaredWeight: order?.declaredWeight || 'N/A',
        forwardCharge: s.forwardCharge,
        rtoCharge: s.rtoCharge,
        codHandlingFee: s.codHandlingFee,
        courierPartner: order?.courierPartner || 'N/A',
        orderStatus: order?.orderStatus || 'N/A',
        merchantId: order?.merchantId || 'N/A',
        settlementDate: s.settlementDate
          ? new Date(s.settlementDate).toISOString().split('T')[0]
          : '',
        discrepancies: s.discrepancies
          ?.map((d) => d.rule)
          .join('; ') || '',
      };
    });

    const csvContent = toCSV(csvRecords);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=settlements_${Date.now()}.csv`
    );
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};
