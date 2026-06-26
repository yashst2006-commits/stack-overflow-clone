import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import userroutes from "./routes/auth.js";
import questionroute from "./routes/question.js";
import answerroutes from "./routes/answer.js";
import friendroutes from "./routes/friend.js";
import postroutes from "./routes/post.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
dotenv.config();

app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("Stackoverflow clone is running perfect");
});

app.use("/user", userroutes);
app.use("/questions", questionroute);
app.use("/question", questionroute);
app.use("/answer", answerroutes);
app.use("/friends", friendroutes);
app.use("/posts", postroutes);

const PORT = process.env.PORT || 5000;
const databaseurl = process.env.MONGODB_URL;

if (!databaseurl) {
  console.warn(
    "MONGODB_URL is not configured. Using local file storage for auth in development."
  );
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "stack-overflow-clone-dev-secret";
  console.warn("JWT_SECRET is not configured. Using a development-only secret.");
}

if (databaseurl) {
  mongoose
    .connect(databaseurl, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      console.log("Connected to MongoDB");
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err.message);
    });
} else {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
