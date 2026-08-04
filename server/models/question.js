import mongoose from "mongoose";

const QuestionSchema = mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    tags: { type: [String], required: true },
    votes: { type: Number, default: 0 },
    upvote: { type: [String], default: [] },
    downvote: { type: [String], default: [] },
    views: { type: Number, default: 0 },
    answers: [
      {
        _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        userId: { type: String, required: true, trim: true },
        username: { type: String, required: true, trim: true },
        answer: { type: String, required: true, trim: true },
        votes: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    author: { type: mongoose.Schema.Types.Mixed, required: true },
    authorName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Performance Indexes
QuestionSchema.index({ title: 1 });
QuestionSchema.index({ author: 1 });
QuestionSchema.index({ createdAt: -1 });
QuestionSchema.index({ tags: 1 });

export default mongoose.model("Question", QuestionSchema);
