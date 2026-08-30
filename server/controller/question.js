import mongoose from "mongoose";
import Question from "../models/question.js";
import user from "../models/auth.js";
import {
  getCurrentTime,
  getISTStartOfToday,
  getActivePlan,
  getDailyQuestionLimit,
} from "../utils/timeHelper.js";

// Helper to map MongoDB schema to the exact format expected by frontend
export const mapQuestionToFrontend = (q) => {
  if (!q) return null;
  const doc = q.toObject ? q.toObject() : q;
  return {
    _id: String(doc._id),
    questiontitle: doc.title,
    questionbody: doc.body,
    questiontags: doc.tags || [],
    noofanswer: doc.answers ? doc.answers.length : 0,
    upvote: doc.upvote || [],
    downvote: doc.downvote || [],
    views: doc.views || 0,
    userposted: doc.authorName,
    userid: doc.author ? String(doc.author) : doc.userId,
    askedon: doc.createdAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    answer: (doc.answers || []).map((ans) => ({
      _id: String(ans._id),
      answerbody: ans.answer,
      useranswered: ans.username,
      userid: String(ans.userId),
      answeredon: ans.createdAt,
    })),
  };
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

    const currentUser = await user.findById(payload.userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const currentTime = getCurrentTime();
    const activePlan = getActivePlan(currentUser, currentTime);
    const limit = getDailyQuestionLimit(activePlan);

    let remainingQuestions = "unlimited";

    if (activePlan !== "Gold") {
      const startOfToday = getISTStartOfToday(currentTime);
      const count = await Question.countDocuments({
        author: { $in: [payload.userId, new mongoose.Types.ObjectId(payload.userId)] },
        createdAt: { $gte: startOfToday },
      });

      if (count >= limit) {
        const limitStr = limit === 1 ? "1 question" : `${limit} questions`;
        return res.status(429).json({
          success: false,
          message: `You have reached your ${activePlan} plan limit of ${limitStr} for today.`,
        });
      }

      remainingQuestions = Math.max(0, limit - (count + 1));
    }

    const questionData = {
      title: payload.title.trim(),
      body: payload.description.trim(),
      tags: payload.tags.map((tag) => String(tag).trim()).filter(Boolean),
      author: payload.userId,
      authorName: payload.author || "Unknown user",
      upvote: [],
      downvote: [],
      votes: 0,
      views: 0,
      answers: [],
    };

    if (questionData.tags.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one tag is required",
      });
    }

    const postques = await Question.create(questionData);

    const responsePayload = {
      success: true,
      message: "Question posted successfully",
      data: mapQuestionToFrontend(postques),
    };

    if (activePlan !== "Gold") {
      responsePayload.remainingQuestions = remainingQuestions;
    } else {
      responsePayload.remainingQuestions = "unlimited";
    }

    return res.status(201).json(responsePayload);
  } catch (error) {
    console.error("Unable to save question:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save question",
    });
  }
};

export const checkLimit = async (req, res) => {
  try {
    const userId = req.userid;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    const currentUser = await user.findById(userId).lean();
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const currentTime = getCurrentTime();
    const activePlan = getActivePlan(currentUser, currentTime);
    const limit = getDailyQuestionLimit(activePlan);

    if (activePlan === "Gold") {
      return res.status(200).json({
        success: true,
        plan: activePlan,
        limit: "unlimited",
        postedToday: 0,
        remainingQuestions: "unlimited",
        limitReached: false,
      });
    }

    const startOfToday = getISTStartOfToday(currentTime);
    const postedToday = await Question.countDocuments({
      author: { $in: [userId, new mongoose.Types.ObjectId(userId)] },
      createdAt: { $gte: startOfToday },
    });

    const remainingQuestions = Math.max(0, limit - postedToday);
    const limitReached = postedToday >= limit;

    return res.status(200).json({
      success: true,
      plan: activePlan,
      limit,
      postedToday,
      remainingQuestions,
      limitReached,
    });
  } catch (error) {
    console.error("Error checking question limit:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while checking posting limits",
    });
  }
};

export const getallquestion = async (req, res) => {
  try {
    const allquestion = await Question.find().sort({ createdAt: -1 }).lean();
    const mappedQuestions = allquestion.map(mapQuestionToFrontend);
    return res.status(200).json({ success: true, data: mappedQuestions });
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
    const questionDoc = await Question.findById(_id);
    if (!questionDoc) {
      return res.status(404).json({
        success: false,
        message: "Question unavailable",
      });
    }

    // Verify authorization: check if user is the author of the question
    if (String(questionDoc.author) !== String(req.userid)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this question",
      });
    }

    await Question.findByIdAndDelete(_id);
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
    const questionDoc = await Question.findById(_id);

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

    // Sync the votes count field
    questionDoc.votes = questionDoc.upvote.length - questionDoc.downvote.length;

    const questionvote = await Question.findByIdAndUpdate(_id, questionDoc, {
      new: true,
    });

    return res.status(200).json({ success: true, data: mapQuestionToFrontend(questionvote) });
  } catch (error) {
    console.error("Unable to vote question:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to vote question",
    });
  }
};
