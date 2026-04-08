import mongoose from 'mongoose';

const discrepancyDetailSchema = new mongoose.Schema(
  {
    rule: {
      type: String,
      required: true,
      enum: [
        'COD_SHORT_REMITTANCE',
        'WEIGHT_DISPUTE',
        'PHANTOM_RTO_CHARGE',
        'OVERDUE_REMITTANCE',
        'DUPLICATE_SETTLEMENT',
      ],
    },
    expected: { type: mongoose.Schema.Types.Mixed },
    actual: { type: mongoose.Schema.Types.Mixed },
    description: { type: String },
  },
  { _id: false }
);

const settlementSchema = new mongoose.Schema(
  {
    awbNumber: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    settledCodAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    chargedWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    forwardCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    rtoCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    codHandlingFee: {
      type: Number,
      required: true,
      min: 0,
    },
    settlementDate: {
      type: Date,
      default: null,
    },
    batchId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    // Reconciliation status
    status: {
      type: String,
      enum: ['PENDING', 'MATCHED', 'DISCREPANCY', 'PENDING_REVIEW'],
      default: 'PENDING',
      index: true,
    },
    // Discrepancy details (populated after reconciliation)
    discrepancies: [discrepancyDetailSchema],
    // Whether this record has been reconciled
    reconciledAt: {
      type: Date,
      default: null,
    },
    reconciledByJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for idempotency — same AWB in same batch should be unique
settlementSchema.index({ awbNumber: 1, batchId: 1 }, { unique: true });

const Settlement = mongoose.model('Settlement', settlementSchema);
export default Settlement;
