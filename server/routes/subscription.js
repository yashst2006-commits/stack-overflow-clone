import express from "express";
import { getPlans, getCurrentSubscription } from "../controller/subscription.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get("/plans", getPlans);
router.get("/current", auth, getCurrentSubscription);

export default router;
