import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn("[razorpay] WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not defined in environment variables.");
}

const razorpay = new Razorpay({
  key_id: keyId || "",
  key_secret: keySecret || "",
});

export default razorpay;
