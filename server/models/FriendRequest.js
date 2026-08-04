import mongoose from "mongoose";

const friendRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests between the same pair
friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });

// Individual indexes for efficient lookups
friendRequestSchema.index({ sender: 1 });
friendRequestSchema.index({ receiver: 1 });
friendRequestSchema.index({ status: 1 });

const FriendRequest =
  mongoose.models.FriendRequest ||
  mongoose.model("FriendRequest", friendRequestSchema);

export default FriendRequest;
