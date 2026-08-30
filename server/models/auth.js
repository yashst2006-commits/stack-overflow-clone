import mongoose from "mongoose";

const userschema = mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  password: { type: String, required: true },
  about: { type: String, default: "" },
  tags: { type: [String], default: [] },
  joinDate: { type: Date, default: Date.now },
  lastForgotPasswordReset: { type: String, default: null },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
  subscription: {
    plan: { type: String, default: "Free" },
    active: { type: Boolean, default: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
  },
});
export default mongoose.model("user", userschema);
