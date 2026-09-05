import mongoose from "mongoose";
import Question from "../models/question.js";
import userModel from "../models/auth.js";
import { mapQuestionToFrontend } from "../controller/question.js";
import {
  ANSWER_REWARD,
  FIVE_UPVOTE_BONUS,
  ANSWER_DOWNVOTE_PENALTY,
} from "../config/rewardConfig.js";

/**
 * Safely deducts points from a user without allowing the balance to become negative.
 * Uses atomic MongoDB pipeline update or safe fallback.
 */
export const deductUserPoints = async (userId, amount) => {
  if (!userId || amount <= 0) return;
  try {
    // Atomic update: ensure points never drop below 0
    await userModel.updateOne(
      { _id: userId },
      [
        {
          $set: {
            points: {
              $max: [0, { $subtract: [{ $ifNull: ["$points", 0] }, amount] }],
            },
          },
        },
      ]
    );
  } catch (err) {
    // Fallback if pipeline update is not supported in the MongoDB environment
    const userDoc = await userModel.findById(userId);
    if (userDoc) {
      const currentPoints = typeof userDoc.points === "number" ? userDoc.points : 0;
      const updatedPoints = Math.max(0, currentPoints - amount);
      await userModel.updateOne({ _id: userId }, { $set: { points: updatedPoints } });
    }
  }
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
    const newAnswer = {
      userId: authorId,
      username: useranswered || "Unknown user",
      answer: answerText.trim(),
      votes: 0,
      upvote: [],
      downvote: [],
      rewardAwarded: true,
      fiveUpvoteBonusAwarded: false,
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

    // Award +5 answer reward to the answer author (NOT question author)
    await userModel.updateOne(
      { _id: authorId },
      { $inc: { points: ANSWER_REWARD } }
    );

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

export const voteAnswer = async (req, res) => {
  const { id: _id } = req.params;
  const { answerId, answerid, value, userid } = req.body;
  const targetAnswerId = answerId || answerid || req.params.answerId;
  const currentUserId = req.userid || userid;

  if (!currentUserId) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in",
    });
  }

  if (!targetAnswerId) {
    return res.status(400).json({
      success: false,
      message: "Answer ID is required",
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

    const answerObj = questionDoc.answers.find(
      (ans) => String(ans._id) === String(targetAnswerId)
    );

    if (!answerObj) {
      return res.status(404).json({
        success: false,
        message: "Answer not found",
      });
    }

    if (!Array.isArray(answerObj.upvote)) answerObj.upvote = [];
    if (!Array.isArray(answerObj.downvote)) answerObj.downvote = [];

    const upindex = answerObj.upvote.findIndex(
      (id) => String(id) === String(currentUserId)
    );
    const downindex = answerObj.downvote.findIndex(
      (id) => String(id) === String(currentUserId)
    );

    let isNewDownvote = false;

    if (value === "upvote") {
      if (downindex !== -1) {
        answerObj.downvote = answerObj.downvote.filter(
          (id) => String(id) !== String(currentUserId)
        );
      }
      if (upindex === -1) {
        answerObj.upvote.push(String(currentUserId));
      } else {
        answerObj.upvote = answerObj.upvote.filter(
          (id) => String(id) !== String(currentUserId)
        );
      }
    } else if (value === "downvote") {
      if (upindex !== -1) {
        answerObj.upvote = answerObj.upvote.filter(
          (id) => String(id) !== String(currentUserId)
        );
      }
      if (downindex === -1) {
        // User was not downvoting previously: this is a new downvote event!
        answerObj.downvote.push(String(currentUserId));
        isNewDownvote = true;
      } else {
        // Toggling off existing downvote
        answerObj.downvote = answerObj.downvote.filter(
          (id) => String(id) !== String(currentUserId)
        );
      }
    }

    answerObj.votes = answerObj.upvote.length - answerObj.downvote.length;

    // Check if upvote count reaches 5 and 5-upvote bonus hasn't been awarded yet
    const qualifiesForBonus =
      answerObj.upvote.length >= 5 && !answerObj.fiveUpvoteBonusAwarded;

    let updatedQuestion;

    if (qualifiesForBonus) {
      // Atomic findOneAndUpdate to guarantee at-most-once bonus execution
      updatedQuestion = await Question.findOneAndUpdate(
        {
          _id: _id,
          "answers._id": targetAnswerId,
          "answers.fiveUpvoteBonusAwarded": { $ne: true },
        },
        {
          $set: {
            "answers.$.fiveUpvoteBonusAwarded": true,
            "answers.$.upvote": answerObj.upvote,
            "answers.$.downvote": answerObj.downvote,
            "answers.$.votes": answerObj.votes,
          },
        },
        { new: true }
      );

      if (updatedQuestion) {
        // Award 5-upvote bonus (+5 points) to the answer author
        await userModel.updateOne(
          { _id: answerObj.userId },
          { $inc: { points: FIVE_UPVOTE_BONUS } }
        );
      } else {
        // Fallback: If atomic update returned null (already awarded concurrently), update vote arrays normally
        updatedQuestion = await Question.findOneAndUpdate(
          { _id: _id, "answers._id": targetAnswerId },
          {
            $set: {
              "answers.$.upvote": answerObj.upvote,
              "answers.$.downvote": answerObj.downvote,
              "answers.$.votes": answerObj.votes,
            },
          },
          { new: true }
        );
      }
    } else {
      updatedQuestion = await Question.findOneAndUpdate(
        { _id: _id, "answers._id": targetAnswerId },
        {
          $set: {
            "answers.$.upvote": answerObj.upvote,
            "answers.$.downvote": answerObj.downvote,
            "answers.$.votes": answerObj.votes,
          },
        },
        { new: true }
      );
    }

    // Deduct downvote penalty if a NEW downvote event occurred
    if (isNewDownvote) {
      await deductUserPoints(answerObj.userId, ANSWER_DOWNVOTE_PENALTY);
    }

    return res.status(200).json({
      success: true,
      message: "Answer vote updated",
      data: mapQuestionToFrontend(updatedQuestion),
    });
  } catch (error) {
    console.error("Unable to vote answer:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to vote answer",
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

    // Calculate total reward points previously awarded to reverse
    let pointsToReverse = 0;

    // Creation reward reversal (+5)
    if (answerObj.rewardAwarded !== false) {
      pointsToReverse += ANSWER_REWARD;
    }

    // 5-Upvote bonus reversal (+5)
    if (answerObj.fiveUpvoteBonusAwarded === true) {
      pointsToReverse += FIVE_UPVOTE_BONUS;
    }

    // Pull the answer from the Question document
    question.answers.pull(answerid);
    const updatedQuestion = await question.save();

    // Deduct points from the answer author (never below 0)
    if (pointsToReverse > 0) {
      await deductUserPoints(answerObj.userId, pointsToReverse);
    }

    return res.status(200).json({ success: true, data: mapQuestionToFrontend(updatedQuestion) });
  } catch (error) {
    console.error("Unable to delete answer:", error);
    return res.status(500).json({ success: false, message: "Unable to delete answer" });
  }
};


