import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['RECONCILIATION'],
      default: 'RECONCILIATION',
    },
    status: {
      type: String,
      required: true,
      enum: ['RUNNING', 'COMPLETED', 'FAILED'],
      default: 'RUNNING',
    },
    trigger: {
      type: String,
      required: true,
      enum: ['SCHEDULED', 'MANUAL'],
      default: 'SCHEDULED',
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Stats
    totalRecords: {
      type: Number,
      default: 0,
    },
    matchedCount: {
      type: Number,
      default: 0,
    },
    discrepancyCount: {
      type: Number,
      default: 0,
    },
    pendingReviewCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Job = mongoose.model('Job', jobSchema);
export default Job;
