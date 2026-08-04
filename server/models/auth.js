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
});
export default mongoose.model("user", userschema);
