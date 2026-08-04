import mongoose from "mongoose";
import User from "./auth.js";
import FriendRequest from "./FriendRequest.js";

// ---------------------------------------------------------------------------
// Error class (preserved from original)
// ---------------------------------------------------------------------------

export class FriendModelError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "FriendModelError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------




/** Safely parse a string into a Mongoose ObjectId, or throw 404. */
const toObjectId = (id, label = "User") => {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw new FriendModelError(400, `${label} ID is required`);
  }
  if (!mongoose.Types.ObjectId.isValid(id.trim())) {
    throw new FriendModelError(404, `${label} not found`);
  }
  return new mongoose.Types.ObjectId(id.trim());
};

/** Fetch a User by string ID and throw FriendModelError if not found. */
const requireUser = async (id, label = "User") => {
  const oid = toObjectId(id, label);
  const found = await User.findById(oid);
  if (!found) {
    throw new FriendModelError(404, `${label} not found`);
  }
  return found;
};

/** Shape a User document into the public format expected by the frontend. */
const toPublicUser = (u) => ({
  _id: String(u._id),
  name: u.name,
  about: u.about || "",
  tags: Array.isArray(u.tags) ? u.tags : [],
  joinDate: u.joinDate,
});

// ---------------------------------------------------------------------------
// Exported model functions
// ---------------------------------------------------------------------------

/**
 * Send a friend request from userId → receiverId.
 * Returns { receiverId: string }.
 */
export const sendFriendRequest = async (userId, receiverId) => {
  logModelOperation("Sending friend request", { userId, receiverId });

  const [sender, receiver] = await Promise.all([
    requireUser(userId, "User"),
    requireUser(receiverId, "Receiver"),
  ]);

  if (String(sender._id) === String(receiver._id)) {
    throw new FriendModelError(
      400,
      "You cannot send a friend request to yourself"
    );
  }

  // Check if already friends
  const alreadyFriends = sender.friends.some(
    (fid) => String(fid) === String(receiver._id)
  );
  if (alreadyFriends) {
    throw new FriendModelError(409, "You are already friends with this user");
  }

  // Check for an existing pending request in either direction
  const existing = await FriendRequest.findOne({
    $or: [
      { sender: sender._id, receiver: receiver._id },
      { sender: receiver._id, receiver: sender._id },
    ],
    status: "pending",
  });

  if (existing) {
    if (String(existing.sender) === String(sender._id)) {
      throw new FriendModelError(409, "Friend request already sent");
    } else {
      throw new FriendModelError(
        409,
        "This user has already sent you a friend request"
      );
    }
  }

  await FriendRequest.create({ sender: sender._id, receiver: receiver._id });

  logModelOperation("Friend request sent", {
    senderId: String(sender._id),
    receiverId: String(receiver._id),
  });

  return { receiverId: String(receiver._id) };
};

/**
 * Accept a pending friend request.
 * Returns { friendCount: number }.
 */
export const acceptFriendRequest = async (userId, senderId) => {
  logModelOperation("Accepting friend request", { userId, senderId });

  const [currentUser, requestSender] = await Promise.all([
    requireUser(userId, "User"),
    requireUser(senderId, "Sender"),
  ]);

  const request = await FriendRequest.findOne({
    sender: requestSender._id,
    receiver: currentUser._id,
    status: "pending",
  });

  if (!request) {
    throw new FriendModelError(404, "Friend request not found");
  }

  // Mark request as accepted
  request.status = "accepted";
  await request.save();

  // Add each user to the other's friends array (idempotent via $addToSet)
  await Promise.all([
    User.findByIdAndUpdate(currentUser._id, {
      $addToSet: { friends: requestSender._id },
    }),
    User.findByIdAndUpdate(requestSender._id, {
      $addToSet: { friends: currentUser._id },
    }),
  ]);

  // Return updated friend count for the accepting user
  const updated = await User.findById(currentUser._id, "friends");
  const friendCount = updated ? updated.friends.length : 0;

  logModelOperation("Friend request accepted", {
    userId: String(currentUser._id),
    senderId: String(requestSender._id),
    friendCount,
  });

  return { friendCount };
};

/**
 * Reject a pending friend request.
 */
export const rejectFriendRequest = async (userId, senderId) => {
  logModelOperation("Rejecting friend request", { userId, senderId });

  const [currentUser, requestSender] = await Promise.all([
    requireUser(userId, "User"),
    requireUser(senderId, "Sender"),
  ]);

  const request = await FriendRequest.findOne({
    sender: requestSender._id,
    receiver: currentUser._id,
    status: "pending",
  });

  if (!request) {
    throw new FriendModelError(404, "Friend request not found");
  }

  request.status = "rejected";
  await request.save();

  logModelOperation("Friend request rejected", {
    userId: String(currentUser._id),
    senderId: String(requestSender._id),
  });
};

/**
 * Get the full friend list + pending requests for a user.
 * Returns { friends, pendingSent, pendingReceived, friendCount }.
 */
export const getFriendList = async (userId) => {
  logModelOperation("Loading friend list", { userId });

  const oid = toObjectId(userId, "User");

  // Fetch populated friends list, sent pending requests, and received pending requests in parallel
  const [populated, sentRequests, receivedRequests] = await Promise.all([
    User.findById(oid).populate("friends", "_id name about tags joinDate").lean(),
    FriendRequest.find({ sender: oid, status: "pending" })
      .populate("receiver", "_id name about tags joinDate")
      .lean(),
    FriendRequest.find({ receiver: oid, status: "pending" })
      .populate("sender", "_id name about tags joinDate")
      .lean(),
  ]);

  if (!populated) {
    throw new FriendModelError(404, "User not found");
  }

  const friends = (populated.friends || []).map(toPublicUser);

  const pendingSent = sentRequests
    .filter((r) => r.receiver)
    .map((r) => toPublicUser(r.receiver));

  const pendingReceived = receivedRequests
    .filter((r) => r.sender)
    .map((r) => toPublicUser(r.sender));

  return {
    friends,
    pendingSent,
    pendingReceived,
    friendCount: friends.length,
  };
};

/**
 * Remove an accepted friend.
 * Returns { friendCount: number }.
 */
export const removeFriend = async (userId, friendId) => {
  logModelOperation("Removing friend", { userId, friendId });

  const [currentUser, targetFriend] = await Promise.all([
    requireUser(userId, "User"),
    requireUser(friendId, "Friend"),
  ]);

  const isFriends = currentUser.friends.some(
    (fid) => String(fid) === String(targetFriend._id)
  );

  if (!isFriends) {
    throw new FriendModelError(404, "Friendship not found");
  }

  // Remove from both sides
  await Promise.all([
    User.findByIdAndUpdate(currentUser._id, {
      $pull: { friends: targetFriend._id },
    }),
    User.findByIdAndUpdate(targetFriend._id, {
      $pull: { friends: currentUser._id },
    }),
  ]);

  const updated = await User.findById(currentUser._id, "friends");
  const friendCount = updated ? updated.friends.length : 0;

  logModelOperation("Friend removed", {
    userId: String(currentUser._id),
    friendId: String(targetFriend._id),
    friendCount,
  });

  return { friendCount };
};

/**
 * Get the accepted friend count for a user.
 * Used by models/post.js for posting restriction.
 */
export const getFriendCount = async (userId) => {
  logModelOperation("Loading friend count", { userId });

  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId).trim())) {
    return 0;
  }

  const u = await User.findById(userId, "friends");
  return u ? u.friends.length : 0;
};
