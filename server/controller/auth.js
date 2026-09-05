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
  if (userData.points === undefined || userData.points === null) {
    userData.points = 0;
  }
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

export const transferPoints = async (req, res) => {
  const senderId = req.userid;
  const { recipientId, amount } = req.body;

  if (!senderId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!recipientId) {
    return res.status(400).json({
      success: false,
      message: "Recipient user ID is required",
    });
  }

  // Validate amount: must be a positive integer
  const parsedAmount = Number(amount);
  if (
    typeof amount === "undefined" ||
    amount === null ||
    typeof parsedAmount !== "number" ||
    !Number.isInteger(parsedAmount) ||
    parsedAmount <= 0 ||
    !Number.isFinite(parsedAmount)
  ) {
    return res.status(400).json({
      success: false,
      message: "Transfer amount must be a positive whole number",
    });
  }

  // Self-transfer check
  if (String(senderId) === String(recipientId)) {
    return res.status(400).json({
      success: false,
      message: "You cannot transfer points to yourself.",
    });
  }

  try {
    // Check if recipient exists
    const recipientUser = await user.findById(recipientId);
    if (!recipientUser) {
      return res.status(404).json({
        success: false,
        message: "Recipient user not found.",
      });
    }

    // Check sender's current balance from DB
    const senderUser = await user.findById(senderId);
    if (!senderUser) {
      return res.status(404).json({
        success: false,
        message: "Sender user not found.",
      });
    }

    const senderCurrentPoints =
      typeof senderUser.points === "number" ? senderUser.points : 0;

    // Minimum eligibility rule: sender points must be > 10
    if (senderCurrentPoints <= 10) {
      return res.status(400).json({
        success: false,
        message: "You need more than 10 points to transfer points.",
      });
    }

    // Sufficient balance check
    if (parsedAmount > senderCurrentPoints) {
      return res.status(400).json({
        success: false,
        message: "You do not have enough points to complete this transfer.",
      });
    }

    // Atomic deduction on sender: query condition ensures points > 10 AND points >= parsedAmount
    const senderUpdate = await user.findOneAndUpdate(
      {
        _id: senderId,
        points: { $gt: 10, $gte: parsedAmount },
      },
      [
        {
          $set: {
            points: {
              $subtract: [{ $ifNull: ["$points", 0] }, parsedAmount],
            },
          },
        },
      ],
      { new: true }
    );

    if (!senderUpdate) {
      return res.status(400).json({
        success: false,
        message:
          "Point transfer failed due to insufficient points or eligibility.",
      });
    }

    // Atomic addition to recipient
    let recipientUpdate;
    try {
      recipientUpdate = await user.findByIdAndUpdate(
        recipientId,
        { $inc: { points: parsedAmount } },
        { new: true }
      );
    } catch (recipientErr) {
      // Rollback sender's points if recipient update fails
      await user.updateOne({ _id: senderId }, { $inc: { points: parsedAmount } });
      console.error("[auth:controller] Recipient point credit failed, rolled back sender:", recipientErr);
      return res.status(500).json({
        success: false,
        message: "Point transfer failed during recipient processing",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Points transferred successfully.",
      transferredPoints: parsedAmount,
      remainingPoints: senderUpdate.points,
      sender: withoutPassword(senderUpdate),
      recipient: withoutPassword(recipientUpdate),
    });
  } catch (error) {
    console.error("[auth:controller] Transfer points error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong during point transfer",
    });
  }
};
