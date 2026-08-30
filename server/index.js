import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import userroutes from "./routes/auth.js";
import questionroute from "./routes/question.js";
import answerroutes from "./routes/answer.js";
import friendroutes from "./routes/friend.js";
import postroutes from "./routes/post.js";
import forgotPasswordroute from "./routes/forgotPassword.js";
import subscriptionRoutes from "./routes/subscription.js";
import paymentRoutes from "./routes/payment.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Validate required environment variables ──────────────────────────────────
const REQUIRED_ENV = [
  "MONGODB_URL",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET"
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());
// Keep /uploads static for backward compatibility with existing local media posts
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ success: true, message: "Stack Overflow Clone API is running" });
});

app.use("/user", userroutes);
app.use("/questions", questionroute);
app.use("/question", questionroute);
app.use("/answer", answerroutes);
app.use("/friends", friendroutes);
app.use("/posts", postroutes);
app.use("/forgot-password", forgotPasswordroute);
app.use("/subscription", subscriptionRoutes);
app.use("/api/payment", paymentRoutes);

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.info("[startup] Connected to MongoDB");
    app.listen(PORT, () => {
      console.info(`[startup] Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[startup] MongoDB connection error:", err.message);
    process.exit(1);
  });
