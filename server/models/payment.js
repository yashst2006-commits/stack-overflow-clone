import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    plan: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
    },
    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpaySignature: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      required: true,
      default: "success",
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    subscriptionStartDate: {
      type: Date,
      required: true,
    },
    subscriptionEndDate: {
      type: Date,
      required: true,
    },
    // Phase 5 — invoice tracking
    invoiceNumber: {
      type: String,
      default: null,
      sparse: true,
    },
    invoiceEmailSent: {
      type: Boolean,
      default: false,
    },
    invoiceEmailSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Payment", paymentSchema);
