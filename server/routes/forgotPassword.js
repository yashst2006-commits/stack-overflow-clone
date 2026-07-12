import express from "express";
import {
  forgotPassword,
  resetPassword,
  generatePasswordHandler,
} from "../controller/forgotPassword.js";

const router = express.Router();

// Phase 1: Verify user
router.post("/", forgotPassword);

// Phase 2: Reset password
router.post("/reset", resetPassword);

// Phase 2: Generate a random password
router.get("/generate", generatePasswordHandler);

export default router;
