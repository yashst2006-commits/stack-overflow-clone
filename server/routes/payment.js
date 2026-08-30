import express from "express";
import { createOrder, verifyPayment } from "../controller/payment.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Protect endpoints using existing auth middleware
router.post("/create-order", auth, createOrder);
router.post("/verify", auth, verifyPayment);

export default router;
