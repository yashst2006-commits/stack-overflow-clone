import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import Question from "../models/question.js";

export const migrateQuestions = async () => {
  try {
    const questionsFile = path.join(process.cwd(), "data", "questions.json");
    let localQuestions = [];
    
    try {
      const content = await fs.readFile(questionsFile, "utf8");
      localQuestions = JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log("[Migration] No questions.json found to migrate.");
        return;
      }
      throw error;
    }

    if (!Array.isArray(localQuestions) || localQuestions.length === 0) {
      console.log("[Migration] questions.json is empty or invalid. No migration needed.");
      return;
    }

    console.log(`[Migration] Found ${localQuestions.length} questions in questions.json. Migrating to MongoDB...`);

    let importedCount = 0;
    let skippedCount = 0;

    for (const q of localQuestions) {
      // Find if this question already exists in MongoDB
      const exists = await Question.findOne({
        $or: [
          { _id: q._id },
          { title: q.questiontitle, authorName: q.userposted }
        ]
      });

      if (!exists) {
        // Map fields to the Mongoose schema format
        const answers = (q.answer || []).map((ans) => ({
          _id: ans._id || new mongoose.Types.ObjectId().toString(),
          userId: ans.userid,
          username: ans.useranswered,
          answer: ans.answerbody || ans.answer,
          votes: ans.votes || 0,
          createdAt: ans.answeredon ? new Date(ans.answeredon) : new Date(),
          updatedAt: ans.answeredon ? new Date(ans.answeredon) : new Date(),
        }));

        const upvotes = q.upvote || [];
        const downvotes = q.downvote || [];

        const questionDoc = {
          _id: q._id,
          title: q.questiontitle,
          body: q.questionbody,
          tags: q.questiontags || [],
          votes: upvotes.length - downvotes.length,
          upvote: upvotes,
          downvote: downvotes,
          views: q.views || 0,
          answers: answers,
          author: q.userid,
          authorName: q.userposted || "Unknown user",
          createdAt: q.askedon ? new Date(q.askedon) : new Date(),
          updatedAt: q.askedon ? new Date(q.askedon) : new Date(),
        };

        await Question.create(questionDoc);
        importedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`[Migration] Migration finished. Imported: ${importedCount}, Skipped (duplicates): ${skippedCount}`);
  } catch (error) {
    console.error("[Migration] Error during questions migration:", error);
  }
};
