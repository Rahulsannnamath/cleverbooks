import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    awbNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    merchantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    courierPartner: {
      type: String,
      required: true,
      enum: ['shiprocket', 'delhivery', 'bluedart', 'dtdc', 'kwikship', 'ecom_express'],
      lowercase: true,
      trim: true,
    },
    orderStatus: {
      type: String,
      required: true,
      enum: ['DELIVERED', 'RTO', 'IN_TRANSIT', 'LOST'],
      uppercase: true,
    },
    codAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    declaredWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    orderDate: {
      type: Date,
      required: true,
    },
    deliveryDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
