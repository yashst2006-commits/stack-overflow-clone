import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(currentDirectory, "..", "data");
const friendsFile = path.join(dataDirectory, "friends.json");
const usersFile = path.join(dataDirectory, "users.json");

let mutationQueue = Promise.resolve();

const logModelOperation = (message, details = {}) => {
  console.info(`[friends:model] ${message}`, details);
};

export class FriendModelError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "FriendModelError";
    this.statusCode = statusCode;
  }
}

const readJsonArray = async (
  filePath,
  { createIfMissing = false, required = false } = {}
) => {
  try {
    const content = await fs.readFile(filePath, "utf8");

    if (!content.trim()) {
      if (createIfMissing) {
        await fs.writeFile(filePath, "[]\n");
        logModelOperation("Initialized empty JSON file", { filePath });
        return [];
      }

      throw new FriendModelError(
        500,
        `${path.basename(filePath)} is empty`
      );
    }

    let parsedContent;

    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      console.error("[friends:model] Invalid JSON", {
        filePath,
        message: error.message,
      });
      throw new FriendModelError(
        500,
        `${path.basename(filePath)} contains invalid JSON`
      );
    }

    if (!Array.isArray(parsedContent)) {
      throw new FriendModelError(
        500,
        `${path.basename(filePath)} must contain a JSON array`
      );
    }

    logModelOperation("Read JSON data", {
      filePath,
      recordCount: parsedContent.length,
    });
    return parsedContent;
  } catch (error) {
    if (error.code === "ENOENT") {
      if (required) {
        throw new FriendModelError(
          500,
          `${path.basename(filePath)} was not found`
        );
      }

      if (createIfMissing) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, "[]\n");
        logModelOperation("Created missing JSON file", { filePath });
      }

      return [];
    }

    throw error;
  }
};

const sameId = (firstId, secondId) => String(firstId) === String(secondId);
const containsId = (ids, targetId) => ids.some((id) => sameId(id, targetId));
const withoutId = (ids, targetId) => ids.filter((id) => !sameId(id, targetId));

const uniqueIds = (ids) => [
  ...new Set(
    ids
      .filter((id) => id !== undefined && id !== null)
      .map(String)
      .filter(Boolean)
  ),
];

const normalizeRecord = (record) => ({
  userId: String(record.userId),
  friends: Array.isArray(record.friends) ? uniqueIds(record.friends) : [],
  pendingSent: Array.isArray(record.pendingSent)
    ? uniqueIds(record.pendingSent)
    : [],
  pendingReceived: Array.isArray(record.pendingReceived)
    ? uniqueIds(record.pendingReceived)
    : [],
});

const findRecord = (friendData, userId) =>
  friendData.find((record) => sameId(record.userId, userId));

const findOrCreateRecord = (friendData, userId) => {
  let record = findRecord(friendData, userId);

  if (!record) {
    record = {
      userId: String(userId),
      friends: [],
      pendingSent: [],
      pendingReceived: [],
    };
    friendData.push(record);
  }

  return record;
};

const validateId = (userId, label) => {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new FriendModelError(400, `${label} ID is required`);
  }

  return userId.trim();
};

const getUsers = () => readJsonArray(usersFile, { required: true });

const requireUser = (users, userId, label = "User") => {
  const validUserId = validateId(userId, label);
  const matchedUser = users.find((user) => sameId(user._id, validUserId));

  if (!matchedUser) {
    throw new FriendModelError(404, `${label} not found`);
  }

  return String(matchedUser._id);
};

const toPublicUser = (user) => ({
  _id: String(user._id),
  name: user.name,
  about: user.about || "",
  tags: Array.isArray(user.tags) ? user.tags : [],
  joinDate: user.joinDate,
});

const populateUsers = (ids, users) =>
  ids
    .map((id) => users.find((user) => sameId(user._id, id)))
    .filter(Boolean)
    .map(toPublicUser);

const runMutation = (operation) => {
  const nextMutation = mutationQueue.then(operation, operation);
  mutationQueue = nextMutation.then(
    () => undefined,
    () => undefined
  );
  return nextMutation;
};

export const getFriendData = async () => {
  const data = await readJsonArray(friendsFile, { createIfMissing: true });
  const validRecords = data.filter(
    (record) => record && record.userId !== undefined && record.userId !== null
  );

  if (validRecords.length !== data.length) {
    console.warn("[friends:model] Ignored malformed friend records", {
      ignoredCount: data.length - validRecords.length,
    });
  }

  return validRecords.map(normalizeRecord);
};

export const saveFriendData = async (friendData) => {
  if (!Array.isArray(friendData)) {
    throw new TypeError("Friend data must be an array");
  }

  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(friendsFile, `${JSON.stringify(friendData, null, 2)}\n`);
  logModelOperation("Saved friend data", {
    filePath: friendsFile,
    recordCount: friendData.length,
  });
};

export const sendFriendRequest = (userId, receiverId) =>
  runMutation(async () => {
    logModelOperation("Sending friend request", { userId, receiverId });
    const users = await getUsers();
    const currentUserId = requireUser(users, userId);
    const targetUserId = requireUser(users, receiverId, "Receiver");

    if (sameId(currentUserId, targetUserId)) {
      throw new FriendModelError(
        400,
        "You cannot send a friend request to yourself"
      );
    }

    const friendData = await getFriendData();
    const currentUser = findOrCreateRecord(friendData, currentUserId);
    const receiver = findOrCreateRecord(friendData, targetUserId);

    if (
      containsId(currentUser.friends, targetUserId) ||
      containsId(receiver.friends, currentUserId)
    ) {
      throw new FriendModelError(409, "You are already friends with this user");
    }

    if (
      containsId(currentUser.pendingSent, targetUserId) ||
      containsId(receiver.pendingReceived, currentUserId)
    ) {
      throw new FriendModelError(409, "Friend request already sent");
    }

    if (
      containsId(currentUser.pendingReceived, targetUserId) ||
      containsId(receiver.pendingSent, currentUserId)
    ) {
      throw new FriendModelError(
        409,
        "This user has already sent you a friend request"
      );
    }

    currentUser.pendingSent.push(targetUserId);
    receiver.pendingReceived.push(currentUserId);
    await saveFriendData(friendData);

    return { receiverId: targetUserId };
  });

export const acceptFriendRequest = (userId, senderId) =>
  runMutation(async () => {
    logModelOperation("Accepting friend request", { userId, senderId });
    const users = await getUsers();
    const currentUserId = requireUser(users, userId);
    const requestSenderId = requireUser(users, senderId, "Sender");
    const friendData = await getFriendData();
    const currentUser = findRecord(friendData, currentUserId);
    const sender = findRecord(friendData, requestSenderId);

    const requestExists =
      currentUser &&
      sender &&
      containsId(currentUser.pendingReceived, requestSenderId) &&
      containsId(sender.pendingSent, currentUserId);

    if (!requestExists) {
      throw new FriendModelError(404, "Friend request not found");
    }

    currentUser.pendingReceived = withoutId(
      currentUser.pendingReceived,
      requestSenderId
    );
    sender.pendingSent = withoutId(sender.pendingSent, currentUserId);

    if (!containsId(currentUser.friends, requestSenderId)) {
      currentUser.friends.push(requestSenderId);
    }

    if (!containsId(sender.friends, currentUserId)) {
      sender.friends.push(currentUserId);
    }

    await saveFriendData(friendData);
    return { friendCount: currentUser.friends.length };
  });

export const rejectFriendRequest = (userId, senderId) =>
  runMutation(async () => {
    logModelOperation("Rejecting friend request", { userId, senderId });
    const users = await getUsers();
    const currentUserId = requireUser(users, userId);
    const requestSenderId = requireUser(users, senderId, "Sender");
    const friendData = await getFriendData();
    const currentUser = findRecord(friendData, currentUserId);
    const sender = findRecord(friendData, requestSenderId);

    if (
      !currentUser ||
      !containsId(currentUser.pendingReceived, requestSenderId)
    ) {
      throw new FriendModelError(404, "Friend request not found");
    }

    currentUser.pendingReceived = withoutId(
      currentUser.pendingReceived,
      requestSenderId
    );

    if (sender) {
      sender.pendingSent = withoutId(sender.pendingSent, currentUserId);
    }

    await saveFriendData(friendData);
  });

export const getFriendList = async (userId) => {
  logModelOperation("Loading friend list", { userId });
  const users = await getUsers();
  const currentUserId = requireUser(users, userId);
  const friendData = await getFriendData();
  const currentUser = findRecord(friendData, currentUserId) || {
    friends: [],
    pendingSent: [],
    pendingReceived: [],
  };

  return {
    friends: populateUsers(currentUser.friends, users),
    pendingSent: populateUsers(currentUser.pendingSent, users),
    pendingReceived: populateUsers(currentUser.pendingReceived, users),
    friendCount: currentUser.friends.length,
  };
};

export const removeFriend = (userId, friendId) =>
  runMutation(async () => {
    logModelOperation("Removing friend", { userId, friendId });
    const users = await getUsers();
    const currentUserId = requireUser(users, userId);
    const targetFriendId = requireUser(users, friendId, "Friend");
    const friendData = await getFriendData();
    const currentUser = findRecord(friendData, currentUserId);
    const friend = findRecord(friendData, targetFriendId);

    if (
      !currentUser ||
      !containsId(currentUser.friends, targetFriendId)
    ) {
      throw new FriendModelError(404, "Friendship not found");
    }

    currentUser.friends = withoutId(currentUser.friends, targetFriendId);

    if (friend) {
      friend.friends = withoutId(friend.friends, currentUserId);
    }

    await saveFriendData(friendData);
    return { friendCount: currentUser.friends.length };
  });

export const getFriendCount = async (userId) => {
  logModelOperation("Loading friend count", { userId });
  const users = await getUsers();
  const currentUserId = requireUser(users, userId);
  const friendData = await getFriendData();
  const currentUser = findRecord(friendData, currentUserId);

  return currentUser ? currentUser.friends.length : 0;
};
