import Job from '../models/Job.js';
import { runReconciliation } from '../services/reconciler.js';

/**
 * Job Controller
 * Handles reconciliation job history and manual trigger.
 */

/**
 * GET /api/jobs
 * List reconciliation job history (latest 10 by default)
 */
export const getJobs = async (req, res, next) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await Job.countDocuments();
    const jobs = await Job.find()
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: {
        jobs,
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
 * POST /api/jobs/trigger
 * Manually trigger a reconciliation run (for demo purposes)
 */
export const triggerReconciliation = async (req, res, next) => {
  try {
    // Check if a reconciliation is already running
    const runningJob = await Job.findOne({ status: 'RUNNING' });
    if (runningJob) {
      return res.status(409).json({
        success: false,
        error: 'A reconciliation job is already running',
        jobId: runningJob._id,
      });
    }

    const job = await runReconciliation('MANUAL');

    res.json({
      success: true,
      message: 'Reconciliation completed',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};
