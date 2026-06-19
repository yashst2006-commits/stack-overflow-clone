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

const normalizeQuestionPayload = (req) => {
  if (req.body.postquestiondata) {
    const data = req.body.postquestiondata;

    return {
      title: data.questiontitle,
      description: data.questionbody,
      tags: data.questiontags,
      userId: data.userid || req.userid,
      author: data.userposted,
    };
  }

  return {
    title: req.body.title,
    description: req.body.description,
    tags: req.body.tags,
    userId: req.body.userId || req.userid,
    author: req.body.author,
  };
};

const validateQuestionPayload = ({ title, description, tags, userId }) => {
  if (!userId) {
    return "You must be logged in";
  }

  if (!title || !title.trim()) {
    return "Title is required";
  }

  if (!description || !description.trim()) {
    return "Description is required";
  }

  if (description.trim().length < 20) {
    return "Description must be at least 20 characters";
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    return "At least one tag is required";
  }

  return null;
};

export const Askquestion = async (req, res) => {
  try {
    const payload = normalizeQuestionPayload(req);
    const validationError = validateQuestionPayload(payload);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const now = new Date();
    const questionData = {
      questiontitle: payload.title.trim(),
      questionbody: payload.description.trim(),
      questiontags: payload.tags.map((tag) => String(tag).trim()).filter(Boolean),
      userposted: payload.author || "Unknown user",
      userid: payload.userId,
      askedon: now,
      views: 0,
    };

    if (questionData.questiontags.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one tag is required",
      });
    }

    if (isMongoConnected()) {
      const postques = await question.create(questionData);

      return res.status(201).json({
        success: true,
        message: "Question posted successfully",
        data: postques,
      });
    }

    const localQuestions = await readLocalQuestions();
    const localQuestion = {
      _id: randomUUID(),
      ...questionData,
      askedon: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      noofanswer: 0,
      upvote: [],
      downvote: [],
      answer: [],
    };

    localQuestions.push(localQuestion);
    await writeLocalQuestions(localQuestions);

    return res.status(201).json({
      success: true,
      message: "Question posted successfully",
      data: localQuestion,
    });
  } catch (error) {
    console.error("Unable to save question:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save question",
    });
  }
};

export const getallquestion = async (req, res) => {
  try {
    if (isMongoConnected()) {
      const allquestion = await question.find().sort({ askedon: -1 });
      return res.status(200).json({ success: true, data: allquestion });
    }

    const allquestion = await readLocalQuestions();
    const sortedQuestions = allquestion.sort(
      (first, second) => new Date(second.askedon) - new Date(first.askedon)
    );

    return res.status(200).json({ success: true, data: sortedQuestions });
  } catch (error) {
    console.error("Unable to fetch questions:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch questions",
    });
  }
};

export const deletequestion = async (req, res) => {
  const { id: _id } = req.params;

  try {
    if (isMongoConnected()) {
      if (!mongoose.Types.ObjectId.isValid(_id)) {
        return res.status(400).json({
          success: false,
          message: "Question unavailable",
        });
      }

      await question.findByIdAndDelete(_id);
      return res.status(200).json({
        success: true,
        message: "Question deleted",
      });
    }

    const localQuestions = await readLocalQuestions();
    const nextQuestions = localQuestions.filter(
      (currentQuestion) => currentQuestion._id !== _id
    );

    if (nextQuestions.length === localQuestions.length) {
      return res.status(400).json({
        success: false,
        message: "Question unavailable",
      });
    }

    await writeLocalQuestions(nextQuestions);
    return res.status(200).json({
      success: true,
      message: "Question deleted",
    });
  } catch (error) {
    console.error("Unable to delete question:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete question",
    });
  }
};

export const votequestion = async (req, res) => {
  const { id: _id } = req.params;
  const { value, userid } = req.body;
  const currentUserId = userid || req.userid;

  if (!currentUserId) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in",
    });
  }

  if (!["upvote", "downvote"].includes(value)) {
    return res.status(400).json({
      success: false,
      message: "Invalid vote type",
    });
  }

  try {
    if (isMongoConnected()) {
      if (!mongoose.Types.ObjectId.isValid(_id)) {
        return res.status(400).json({
          success: false,
          message: "Question unavailable",
        });
      }

      const questionDoc = await question.findById(_id);

      if (!questionDoc) {
        return res.status(404).json({
          success: false,
          message: "Question unavailable",
        });
      }

      const upindex = questionDoc.upvote.findIndex(
        (id) => id === String(currentUserId)
      );
      const downindex = questionDoc.downvote.findIndex(
        (id) => id === String(currentUserId)
      );

      if (value === "upvote") {
        if (downindex !== -1) {
          questionDoc.downvote = questionDoc.downvote.filter(
            (id) => id !== String(currentUserId)
          );
        }
        if (upindex === -1) {
          questionDoc.upvote.push(currentUserId);
        } else {
          questionDoc.upvote = questionDoc.upvote.filter(
            (id) => id !== String(currentUserId)
          );
        }
      } else if (value === "downvote") {
        if (upindex !== -1) {
          questionDoc.upvote = questionDoc.upvote.filter(
            (id) => id !== String(currentUserId)
          );
        }
        if (downindex === -1) {
          questionDoc.downvote.push(currentUserId);
        } else {
          questionDoc.downvote = questionDoc.downvote.filter(
            (id) => id !== String(currentUserId)
          );
        }
      }

      const questionvote = await question.findByIdAndUpdate(_id, questionDoc, {
        new: true,
      });

      return res.status(200).json({ success: true, data: questionvote });
    }

    const localQuestions = await readLocalQuestions();
    const questionIndex = localQuestions.findIndex(
      (currentQuestion) => currentQuestion._id === _id
    );

    if (questionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Question unavailable",
      });
    }

    const currentQuestion = localQuestions[questionIndex];
    currentQuestion.upvote = currentQuestion.upvote || [];
    currentQuestion.downvote = currentQuestion.downvote || [];

    if (value === "upvote") {
      currentQuestion.downvote = currentQuestion.downvote.filter(
        (id) => id !== String(currentUserId)
      );
      currentQuestion.upvote = currentQuestion.upvote.includes(currentUserId)
        ? currentQuestion.upvote.filter((id) => id !== String(currentUserId))
        : [...currentQuestion.upvote, currentUserId];
    }

    if (value === "downvote") {
      currentQuestion.upvote = currentQuestion.upvote.filter(
        (id) => id !== String(currentUserId)
      );
      currentQuestion.downvote = currentQuestion.downvote.includes(currentUserId)
        ? currentQuestion.downvote.filter((id) => id !== String(currentUserId))
        : [...currentQuestion.downvote, currentUserId];
    }

    currentQuestion.updatedAt = new Date().toISOString();
    localQuestions[questionIndex] = currentQuestion;
    await writeLocalQuestions(localQuestions);

    return res.status(200).json({ success: true, data: currentQuestion });
  } catch (error) {
    console.error("Unable to vote question:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to vote question",
    });
  }
};
