import mongoose from "mongoose";
import Question from "../models/question.js";
import { mapQuestionToFrontend } from "../controller/question.js";

const getAnswerMessage = (answerbody) => {
  if (!answerbody || !answerbody.trim()) {
    return "Answer cannot be empty";
  }

  if (answerbody.trim().length < 20) {
    return "Answer must contain at least 20 characters";
  }

  return null;
};

export const Askanswer = async (req, res) => {
  const { id: _id } = req.params;
  const { answer, answerbody, useranswered, userid } = req.body;
  const answerText = answerbody || answer;
  const authorId = req.userid || userid;
  const validationMessage = getAnswerMessage(answerText);

  if (!authorId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (validationMessage) {
    return res.status(400).json({
      success: false,
      message: validationMessage,
    });
  }

  try {
    const newAnswer = {
      userId: authorId,
      username: useranswered || "Unknown user",
      answer: answerText.trim(),
      votes: 0,
    };

    const updatequestion = await Question.findByIdAndUpdate(
      _id,
      {
        $push: { answers: newAnswer },
      },
      { new: true }
    );

    if (!updatequestion) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Answer posted successfully",
      data: mapQuestionToFrontend(updatequestion),
    });
  } catch (error) {
    console.error("Database save failed:", error);
    return res.status(500).json({
      success: false,
      message: "Database save failed",
    });
  }
};

export const deleteanswer = async (req, res) => {
  const { id: _id } = req.params;
  const { answerid } = req.body;

  if (!answerid) {
    return res.status(400).json({ success: false, message: "Answer unavailable" });
  }

  try {
    const question = await Question.findById(_id);
    if (!question) {
      return res.status(404).json({ success: false, message: "Question unavailable" });
    }

    const answerObj = question.answers.find((ans) => String(ans._id) === String(answerid));
    if (!answerObj) {
      return res.status(404).json({ success: false, message: "Answer not found" });
    }

    // Verify authorization: check if user is the author of the answer
    if (String(answerObj.userId) !== String(req.userid)) {
      return res.status(403).json({ success: false, message: "You are not authorized to delete this answer" });
    }

    question.answers.pull(answerid);
    const updatedQuestion = await question.save();

    return res.status(200).json({ success: true, data: mapQuestionToFrontend(updatedQuestion) });
  } catch (error) {
    console.error("Unable to delete answer:", error);
    return res.status(500).json({ success: false, message: "Unable to delete answer" });
  }
};
