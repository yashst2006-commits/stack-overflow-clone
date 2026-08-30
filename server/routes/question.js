import express from "express";
import {
  Askquestion,
  deletequestion,
  getallquestion,
  votequestion,
  checkLimit,
} from "../controller/question.js";

const router = express.Router();
import auth from "../middleware/auth.js";
router.get("/check-limit", auth, checkLimit);
router.post("/", auth, Askquestion);
router.get("/", getallquestion);
router.post("/ask", auth, Askquestion);
router.get("/getallquestion", getallquestion);
router.delete("/delete/:id", auth, deletequestion);
router.patch("/vote/:id", auth, votequestion);

export default router;
