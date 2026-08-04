import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import User from "../models/auth.js";
import FriendRequest from "../models/FriendRequest.js";

/**
 * Minimal migration-tracking schema.
 * Stores one document per named migration so we never re-run it.
 */
const migrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  ranAt: { type: Date, default: Date.now },
});
const Migration =
  mongoose.models.Migration ||
  mongoose.model("Migration", migrationSchema);

const MIGRATION_NAME = "friends-json-to-mongodb-v1";

/**
 * One-time migration: import friend data from friends.json into MongoDB.
 *
 * Guard: skip entirely if a Migration document named MIGRATION_NAME already
 * exists — this is idempotent even when friends.json has UUID-based user IDs
 * that don't match any MongoDB user (they are simply skipped with a warning).
 *
 * Does NOT delete or modify friends.json.
 */
export const migrateFriends = async () => {
  try {
    // ── Guard: already ran? ────────────────────────────────────────────────
    const alreadyRan = await Migration.findOne({ name: MIGRATION_NAME });
    if (alreadyRan) {
      console.log(
        `[FriendMigration] Skipping — migration "${MIGRATION_NAME}" already ran at ${alreadyRan.ranAt.toISOString()}.`
      );
      return;
    }

    // ── Read source file ───────────────────────────────────────────────────
    const friendsFile = path.join(process.cwd(), "data", "friends.json");
    let localFriends = [];

    try {
      const content = await fs.readFile(friendsFile, "utf8");
      localFriends = JSON.parse(content);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log("[FriendMigration] No friends.json found. Marking migration as done.");
        await Migration.create({ name: MIGRATION_NAME });
        return;
      }
      throw err;
    }

    if (!Array.isArray(localFriends) || localFriends.length === 0) {
      console.log("[FriendMigration] friends.json is empty. Marking migration as done.");
      await Migration.create({ name: MIGRATION_NAME });
      return;
    }

    console.log(
      `[FriendMigration] Found ${localFriends.length} record(s) in friends.json. Starting migration…`
    );

    // ── Build lookup: legacy string _id → MongoDB User document ───────────
    // Covers both UUID strings (pre-Mongo era) and ObjectId strings.
    const allMongoUsers = await User.find({});
    const legacyIdToUser = new Map();
    for (const u of allMongoUsers) {
      legacyIdToUser.set(String(u._id), u);
    }

    let acceptedImported = 0;
    let pendingImported = 0;
    let skipped = 0;

    // Track processed pairs to avoid duplicate upserts within this run
    const processedAccepted = new Set();

    for (const record of localFriends) {
      const legacyUserId = String(record.userId || "");
      const mongoUser = legacyIdToUser.get(legacyUserId);

      if (!mongoUser) {
        console.warn(
          `[FriendMigration] User with legacy ID "${legacyUserId}" not found in MongoDB — skipping record.`
        );
        skipped++;
        continue;
      }

      // ── Accepted friends ───────────────────────────────────────────────
      for (const legacyFriendId of record.friends || []) {
        const mongoFriend = legacyIdToUser.get(String(legacyFriendId));
        if (!mongoFriend) {
          console.warn(
            `[FriendMigration] Friend with legacy ID "${legacyFriendId}" not found in MongoDB — skipping.`
          );
          skipped++;
          continue;
        }

        // Canonical pair key (sort smaller ObjectId first) avoids double-inserting
        const ids = [String(mongoUser._id), String(mongoFriend._id)].sort();
        const pairKey = ids.join("|");
        if (processedAccepted.has(pairKey)) continue;
        processedAccepted.add(pairKey);

        const [aId, bId] = ids.map((id) => new mongoose.Types.ObjectId(id));

        await FriendRequest.updateOne(
          { sender: aId, receiver: bId },
          { $setOnInsert: { sender: aId, receiver: bId, status: "accepted" } },
          { upsert: true }
        );

        await Promise.all([
          User.findByIdAndUpdate(mongoUser._id, { $addToSet: { friends: mongoFriend._id } }),
          User.findByIdAndUpdate(mongoFriend._id, { $addToSet: { friends: mongoUser._id } }),
        ]);

        acceptedImported++;
      }

      // ── Pending received ───────────────────────────────────────────────
      for (const legacySenderId of record.pendingReceived || []) {
        const mongoSender = legacyIdToUser.get(String(legacySenderId));
        if (!mongoSender) {
          console.warn(
            `[FriendMigration] Pending sender with legacy ID "${legacySenderId}" not found in MongoDB — skipping.`
          );
          skipped++;
          continue;
        }

        await FriendRequest.updateOne(
          { sender: mongoSender._id, receiver: mongoUser._id },
          {
            $setOnInsert: {
              sender: mongoSender._id,
              receiver: mongoUser._id,
              status: "pending",
            },
          },
          { upsert: true }
        );

        pendingImported++;
      }
    }

    console.log(
      `[FriendMigration] Migration complete. ` +
        `Accepted friendships: ${acceptedImported}, ` +
        `Pending requests: ${pendingImported}, ` +
        `Skipped (user not in MongoDB): ${skipped}.`
    );

    // ── Mark migration as done ─────────────────────────────────────────────
    await Migration.create({ name: MIGRATION_NAME });
    console.log(`[FriendMigration] Marked "${MIGRATION_NAME}" as complete.`);
  } catch (err) {
    console.error("[FriendMigration] Error during migration:", err);
    // Do NOT mark as done on error so it can be retried on next boot.
  }
};
