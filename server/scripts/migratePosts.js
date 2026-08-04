import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import User from "../models/auth.js";
import { PostModel } from "../models/post.js";

// Minimal migration tracking schema
const migrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  ranAt: { type: Date, default: Date.now },
});
const Migration =
  mongoose.models.Migration ||
  mongoose.model("Migration", migrationSchema);

const MIGRATION_NAME = "posts-json-to-mongodb-v1";

export const migratePosts = async () => {
  try {
    // ── Guard: already ran? ────────────────────────────────────────────────
    const alreadyRan = await Migration.findOne({ name: MIGRATION_NAME });
    if (alreadyRan) {
      console.log(
        `[PostMigration] Skipping — migration "${MIGRATION_NAME}" already ran at ${alreadyRan.ranAt.toISOString()}.`
      );
      return;
    }

    // ── Read source file ───────────────────────────────────────────────────
    const postsFile = path.join(process.cwd(), "data", "posts.json");
    let localPosts = [];

    try {
      const content = await fs.readFile(postsFile, "utf8");
      localPosts = JSON.parse(content);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log("[PostMigration] No posts.json found. Marking migration as done.");
        await Migration.create({ name: MIGRATION_NAME });
        return;
      }
      throw err;
    }

    if (!Array.isArray(localPosts) || localPosts.length === 0) {
      console.log("[PostMigration] posts.json is empty. Marking migration as done.");
      await Migration.create({ name: MIGRATION_NAME });
      return;
    }

    console.log(
      `[PostMigration] Found ${localPosts.length} record(s) in posts.json. Starting migration…`
    );

    // ── Build lookups to map legacy string user IDs to MongoDB user ObjectIds ──
    const allMongoUsers = await User.find({});
    
    // Map email -> mongo user doc
    const emailToMongoUser = new Map();
    // Map legacy string _id (if present as exact match) -> mongo user doc
    const legacyIdToUserDoc = new Map();
    
    for (const u of allMongoUsers) {
      emailToMongoUser.set(u.email.toLowerCase(), u);
      legacyIdToUserDoc.set(String(u._id), u);
    }

    // Map legacy uuid -> email from users.json
    const usersFile = path.join(process.cwd(), "data", "users.json");
    const legacyIdToMongoId = new Map();

    try {
      const usersContent = await fs.readFile(usersFile, "utf8");
      const localUsers = JSON.parse(usersContent);
      if (Array.isArray(localUsers)) {
        for (const lu of localUsers) {
          const email = lu.email ? lu.email.toLowerCase() : "";
          const mongoUser = emailToMongoUser.get(email) || legacyIdToUserDoc.get(String(lu._id));
          if (mongoUser) {
            legacyIdToMongoId.set(String(lu._id), mongoUser._id);
          }
        }
      }
    } catch (e) {
      console.warn("[PostMigration] Could not read users.json for mapping legacy IDs. Will match by direct string IDs if possible.");
    }

    // Helper to resolve string ID (legacy UUID or MongoDB ObjectId) to Mongoose ObjectId
    const resolveUserObjectId = (legacyId) => {
      if (!legacyId) return null;
      const strId = String(legacyId).trim();
      const mapped = legacyIdToMongoId.get(strId);
      if (mapped) return mapped;
      
      const directDoc = legacyIdToUserDoc.get(strId);
      if (directDoc) return directDoc._id;

      if (mongoose.Types.ObjectId.isValid(strId)) {
        return new mongoose.Types.ObjectId(strId);
      }
      return null;
    };

    let importedCount = 0;
    let skippedCount = 0;

    for (const p of localPosts) {
      const authorId = resolveUserObjectId(p.userId);
      if (!authorId) {
        console.warn(`[PostMigration] Could not find MongoDB user matching legacy userId "${p.userId}" for post — skipping post.`);
        skippedCount++;
        continue;
      }

      // Map likes
      const likesMapped = (p.likes || [])
        .map(resolveUserObjectId)
        .filter(Boolean);

      // Map comments
      const commentsMapped = (p.comments || [])
        .map((c) => {
          const commentAuthorId = resolveUserObjectId(c.userId);
          if (!commentAuthorId) return null;
          return {
            userId: commentAuthorId,
            username: c.username || "Unknown",
            text: c.text || "",
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          };
        })
        .filter(Boolean);

      // Map sharing fields
      const originalPostIdMapped = p.originalPostId && mongoose.Types.ObjectId.isValid(String(p.originalPostId))
        ? new mongoose.Types.ObjectId(String(p.originalPostId))
        : null;

      const originalAuthorIdMapped = p.originalAuthorId
        ? resolveUserObjectId(p.originalAuthorId)
        : null;

      const postDoc = {
        author: authorId,
        authorName: p.username || "Unknown",
        caption: p.caption || null,
        imageUrl: p.imageUrl || null,
        videoUrl: p.videoUrl || null,
        likes: likesMapped,
        comments: commentsMapped,
        isShared: p.isShared || false,
        originalPostId: originalPostIdMapped,
        originalAuthorId: originalAuthorIdMapped,
        originalAuthor: p.originalAuthor || null,
        shareCaption: p.shareCaption || null,
        shareCount: p.shareCount || 0,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        visibility: "public",
      };

      await PostModel.create(postDoc);
      importedCount++;
    }

    console.log(
      `[PostMigration] Migration finished. Imported: ${importedCount}, Skipped: ${skippedCount}`
    );

    // ── Mark migration as done ─────────────────────────────────────────────
    await Migration.create({ name: MIGRATION_NAME });
    console.log(`[PostMigration] Marked "${MIGRATION_NAME}" as complete.`);
  } catch (err) {
    console.error("[PostMigration] Error during migration:", err);
  }
};
