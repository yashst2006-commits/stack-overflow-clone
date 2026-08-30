import razorpay from "../config/razorpay.js";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils.js";
import userModel from "../models/auth.js";
import PaymentModel from "../models/payment.js";
import { isPaymentWindowOpen } from "../utils/timeHelper.js";

// Define plan amounts in INR (Bronze = 100, Silver = 300, Gold = 1000)
const PLAN_AMOUNTS = {
  Bronze: 100,
  Silver: 300,
  Gold: 1000,
};

/**
 * Creates a Razorpay order for a selected plan
 * POST /api/payment/create-order
 */
export const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;

    // Check payment window time restriction (Step 2)
    if (!isPaymentWindowOpen()) {
      return res.status(403).json({
        success: false,
        message: "Payments are allowed only between 10:00 AM and 11:00 AM IST.",
      });
    }

    // Validate if the environment variables are set
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error("[payment:controller] Missing Razorpay environment credentials");
      return res.status(500).json({
        success: false,
        message: "Razorpay server credentials are not configured",
      });
    }

    // Validate if plan is present
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Plan name is required",
      });
    }

    // Validate plan name
    if (plan.toLowerCase() === "free") {
      return res.status(400).json({
        success: false,
        message: "Free plan does not require payment order creation",
      });
    }

    const amountInInr = PLAN_AMOUNTS[plan];
    if (!amountInInr) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan selected: '${plan}'. Supported plans: Bronze, Silver, Gold`,
      });
    }

    // Razorpay amount is in paise (1 INR = 100 paise)
    const amountInPaise = amountInInr * 100;
    const receiptId = `receipt_order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receiptId,
    };

    // Create the order using Razorpay SDK
    const order = await razorpay.orders.create(options);

    return res.status(201).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount, // in paise
      currency: order.currency,
      plan: plan,
    });
  } catch (error) {
    console.error("[payment:controller] Razorpay order creation failed. Details:", {
      message: error.message,
      statusCode: error.statusCode,
      errorResponse: error.error || error,
    });
    return res.status(500).json({
      success: false,
      message: error.error?.description || "Razorpay server error. Failed to create order",
      error: error.message,
      details: error.error || null,
    });
  }
};

/**
 * Verifies Razorpay payment signature and updates user subscription
 * POST /api/payment/verify
 */
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, selectedPlan } = req.body;
    const userId = req.userid; // from auth middleware

    // Check payment window time restriction (Step 3)
    if (!isPaymentWindowOpen()) {
      return res.status(403).json({
        success: false,
        message: "The payment window has closed. Payments are allowed only between 10:00 AM and 11:00 AM IST.",
      });
    }

    // 1. Check required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !selectedPlan) {
      return res.status(400).json({
        success: false,
        message: "Missing required verification fields",
      });
    }

    // 2. Validate selected plan
    const amountInInr = PLAN_AMOUNTS[selectedPlan];
    if (!amountInInr) {
      return res.status(400).json({
        success: false,
        message: `Invalid selected plan: '${selectedPlan}'. Supported plans: Bronze, Silver, Gold. Free plan is rejected.`,
      });
    }

    // 3. Verify signature using official Razorpay verification method
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("[payment:controller] Missing RAZORPAY_KEY_SECRET configuration");
      return res.status(500).json({
        success: false,
        message: "Razorpay server secret is not configured",
      });
    }

    const isValidSignature = validatePaymentVerification(
      {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
      },
      razorpay_signature,
      secret
    );

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed. Verification rejected.",
      });
    }

    // 4. Prevent duplicate payment verification
    const existingPayment = await PaymentModel.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Duplicate payment verification. This transaction has already been processed.",
      });
    }

    // 5. Find User
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 6. Update user's subscription
    const currentDateTime = new Date();
    const expiryDateTime = new Date(currentDateTime.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later

    user.subscription = {
      plan: selectedPlan,
      active: true,
      startDate: currentDateTime,
      endDate: expiryDateTime,
    };
    await user.save();

    // 7. Store payment document
    const newPayment = new PaymentModel({
      userId,
      plan: selectedPlan,
      amount: amountInInr,
      currency: "INR",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentStatus: "success",
      paymentDate: currentDateTime,
      subscriptionStartDate: currentDateTime,
      subscriptionEndDate: expiryDateTime,
    });
    await newPayment.save();

    return res.status(200).json({
      success: true,
      message: "Subscription activated successfully.",
      subscription: user.subscription,
    });
  } catch (error) {
    console.error("[payment:controller] Verification failed with server error:", error);
    return res.status(500).json({
      success: false,
      message: "Database or internal server error during payment verification",
      error: error.message,
    });
  }
};
