import mongoose from "mongoose";
import user from "../models/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const withoutPassword = (currentUser) => {
  const userData =
    typeof currentUser.toObject === "function"
      ? currentUser.toObject()
      : { ...currentUser };

  delete userData.password;
  return userData;
};

const createToken = (currentUser) =>
  jwt.sign(
    { email: currentUser.email, id: currentUser._id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

export const Signup = async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const [existingEmailUser, existingPhoneUser] = await Promise.all([
      user.findOne({ email: email.toLowerCase().trim() }).lean(),
      user.findOne({ phone: phone.trim() }).lean(),
    ]);

    if (existingEmailUser) {
      return res.status(409).json({ success: false, message: "User with this email already exists" });
    }

    if (existingPhoneUser) {
      return res.status(409).json({ success: false, message: "User with this phone number already exists" });
    }

    const hashpassword = await bcrypt.hash(password, 12);
    const newuser = await user.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashpassword,
    });

    return res.status(201).json({
      success: true,
      data: withoutPassword(newuser),
      token: createToken(newuser),
    });
  } catch (error) {
    console.error("[auth:controller] Signup error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const Login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const exisitinguser = await user.findOne({ email: email.toLowerCase().trim() }).lean();
    if (!exisitinguser) {
      return res.status(404).json({ success: false, message: "User does not exist" });
    }

    const ispasswordcrct = await bcrypt.compare(
      password,
      exisitinguser.password
    );
    if (!ispasswordcrct) {
      return res.status(400).json({ success: false, message: "Invalid password" });
    }

    return res.status(200).json({
      success: true,
      data: withoutPassword(exisitinguser),
      token: createToken(exisitinguser),
    });
  } catch (error) {
    console.error("[auth:controller] Login error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const getallusers = async (req, res) => {
  try {
    const alluser = await user.find().lean();
    return res.status(200).json({ success: true, data: alluser.map(withoutPassword) });
  } catch (error) {
    console.error("[auth:controller] getallusers error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { name, about, tags } = req.body.editForm;

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ success: false, message: "User unavailable" });
  }

  if (String(req.userid) !== String(_id)) {
    return res.status(403).json({ success: false, message: "You are not authorized to update this profile" });
  }

  try {
    const updateprofile = await user.findByIdAndUpdate(
      _id,
      { $set: { name: name, about: about, tags: tags } },
      { new: true }
    );
    return res.status(200).json({ success: true, data: withoutPassword(updateprofile) });
  } catch (error) {
    console.error("[auth:controller] Update profile error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
