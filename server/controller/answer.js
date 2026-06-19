import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import question from "../models/question.js";

const questionsFile = path.join(process.cwd(), "data", "questions.json");

const isMongoConnected = () => mongoose.connection.readyState === 1;

const readLocalQuestions = async () => {
  try {
    const content = await fs.readFile(questionsFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
};

const writeLocalQuestions = async (questions) => {
  await fs.mkdir(path.dirname(questionsFile), { recursive: true });
  await fs.writeFile(questionsFile, JSON.stringify(questions, null, 2));
};

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
    const answer = {
      answerbody: answerText.trim(),
      useranswered: useranswered || "Unknown user",
      userid: authorId,
    };

    if (isMongoConnected()) {
      if (!mongoose.Types.ObjectId.isValid(_id)) {
        return res.status(400).json({
          success: false,
          message: "Question not found",
        });
      }

      const updatequestion = await question.findByIdAndUpdate(
        _id,
        {
          $push: { answer },
          $inc: { noofanswer: 1 },
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
        data: updatequestion,
      });
    }

    const localQuestions = await readLocalQuestions();
    const questionIndex = localQuestions.findIndex(
      (currentQuestion) => currentQuestion._id === _id
    );

    if (questionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const now = new Date().toISOString();
    const localAnswer = {
      _id: randomUUID(),
      ...answer,
      answeredon: now,
    };

    const currentQuestion = localQuestions[questionIndex];
    const answers = [...(currentQuestion.answer || []), localAnswer];
    localQuestions[questionIndex] = {
      ...currentQuestion,
      answer: answers,
      noofanswer: answers.length,
      updatedAt: now,
    };

    await writeLocalQuestions(localQuestions);

    return res.status(201).json({
      success: true,
      message: "Answer posted successfully",
      data: localQuestions[questionIndex],
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
    if (isMongoConnected()) {
      if (!mongoose.Types.ObjectId.isValid(_id)) {
        return res.status(400).json({ success: false, message: "Question unavailable" });
      }
      if (!mongoose.Types.ObjectId.isValid(answerid)) {
        return res.status(400).json({ success: false, message: "Answer unavailable" });
      }

      const updatequestion = await question.findByIdAndUpdate(
        _id,
        {
          $pull: { answer: { _id: answerid } },
          $inc: { noofanswer: -1 },
        },
        { new: true }
      );

      if (!updatequestion) {
        return res.status(404).json({ success: false, message: "Question unavailable" });
      }

      updatequestion.noofanswer = Math.max(updatequestion.answer.length, 0);
      await updatequestion.save();

      return res.status(200).json({ success: true, data: updatequestion });
    }

    const localQuestions = await readLocalQuestions();
    const questionIndex = localQuestions.findIndex(
      (currentQuestion) => currentQuestion._id === _id
    );

    if (questionIndex === -1) {
      return res.status(404).json({ success: false, message: "Question unavailable" });
    }

    const currentQuestion = localQuestions[questionIndex];
    const answers = (currentQuestion.answer || []).filter(
      (answer) => answer._id !== answerid
    );

    localQuestions[questionIndex] = {
      ...currentQuestion,
      answer: answers,
      noofanswer: answers.length,
      updatedAt: new Date().toISOString(),
    };

    await writeLocalQuestions(localQuestions);

    return res.status(200).json({ success: true, data: localQuestions[questionIndex] });
  } catch (error) {
    console.error("Unable to delete answer:", error);
    return res.status(500).json({ success: false, message: "Unable to delete answer" });
  }
};
