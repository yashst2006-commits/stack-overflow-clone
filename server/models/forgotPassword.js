import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import user from "./auth.js";

// ── Lookup helpers ───────────────────────────────────────────────────────────

export const findUserByEmail = async (email) => {
  return await user.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } });
};

export const findUserByPhone = async (phone) => {
  return await user.findOne({ phone: phone });
};

export const findUserByIdentifier = async (identifier) => {
  const isEmail = identifier.includes("@");
  if (isEmail) {
    return await findUserByEmail(identifier);
  } else {
    return await findUserByPhone(identifier);
  }
};

// ── Model functions ──────────────────────────────────────────────────────────

/**
 * Find a user by their _id.
 */
export const findUserById = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  return await user.findById(userId);
};

/**
 * Compare a plaintext password against a bcrypt hash.
 * Returns true if they match.
 */
export const compareOldPassword = async (plaintext, hash) => {
  return await bcrypt.compare(plaintext, hash);
};

/**
 * Count the number of character positions that differ between two strings.
 * We compare up to the length of the longer string (missing chars count as different).
 */
export const validatePasswordDifference = (newPassword, oldPassword) => {
  const maxLen = Math.max(newPassword.length, oldPassword.length);
  let diffCount = 0;
  for (let i = 0; i < maxLen; i++) {
    if (newPassword[i] !== oldPassword[i]) {
      diffCount++;
    }
  }
  return diffCount; // caller checks >= 3
};

/**
 * Persist a new bcrypt-hashed password for the given userId.
 */
export const updatePassword = async (userId, hashedPassword) => {
  await user.findByIdAndUpdate(userId, { $set: { password: hashedPassword } });
};

/**
 * Generate a random 10-character password using only A-Z and a-z.
 */
export const generatePassword = () => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const alphabet = upper + lower;
  let result = "";
  // Guarantee at least one uppercase and one lowercase in the first two slots
  result += upper[Math.floor(Math.random() * upper.length)];
  result += lower[Math.floor(Math.random() * lower.length)];
  for (let i = 2; i < 10; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  // Shuffle so the first two forced chars aren't always in positions 0-1
  return result
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

// ── Daily reset restriction helper methods ───────────────────────────────────

export const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

export const getLastForgotPasswordReset = (foundUser) => {
  return foundUser.lastForgotPasswordReset || null;
};

export const hasResetPasswordToday = (foundUser) => {
  const today = getLocalDateString();
  return foundUser.lastForgotPasswordReset === today;
};

export const updateLastForgotPasswordReset = async (userId, dateStr) => {
  await user.findByIdAndUpdate(userId, { $set: { lastForgotPasswordReset: dateStr } });
};
