import {
  FriendModelError,
  acceptFriendRequest,
  getFriendCount,
  getFriendList,
  rejectFriendRequest,
  removeFriend as removeFriendModel,
  sendFriendRequest,
} from "../models/friend.js";

const handleFriendError = (res, error, fallbackMessage) => {
  if (error instanceof FriendModelError) {
    console.warn("[friends:controller] Request failed", {
      statusCode: error.statusCode,
      message: error.message,
    });
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

export const sendRequest = async (req, res) => {
  try {
    console.info("[friends:controller] sendRequest", {
      currentUser: req.userid,
      body: req.body,
    });
    const result = await sendFriendRequest(req.userid, req.body?.receiverId);
    return res.status(201).json({
      success: true,
      message: "Friend request sent",
      ...result,
    });
  } catch (error) {
    return handleFriendError(res, error, "Unable to send friend request");
  }
};

export const acceptRequest = async (req, res) => {
  try {
    console.info("[friends:controller] acceptRequest", {
      currentUser: req.userid,
      body: req.body,
    });
    const result = await acceptFriendRequest(req.userid, req.body?.senderId);
    return res.status(200).json({
      success: true,
      message: "Friend request accepted",
      ...result,
    });
  } catch (error) {
    return handleFriendError(res, error, "Unable to accept friend request");
  }
};

export const rejectRequest = async (req, res) => {
  try {
    console.info("[friends:controller] rejectRequest", {
      currentUser: req.userid,
      body: req.body,
    });
    await rejectFriendRequest(req.userid, req.body?.senderId);
    return res.status(200).json({
      success: true,
      message: "Friend request rejected",
    });
  } catch (error) {
    return handleFriendError(res, error, "Unable to reject friend request");
  }
};

export const listFriends = async (req, res) => {
  try {
    console.info("[friends:controller] listFriends", {
      currentUser: req.userid,
    });
    const result = await getFriendList(req.userid);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleFriendError(res, error, "Unable to load friends");
  }
};

export const removeFriend = async (req, res) => {
  try {
    console.info("[friends:controller] removeFriend", {
      currentUser: req.userid,
      friendId: req.params.friendId,
    });
    const result = await removeFriendModel(req.userid, req.params.friendId);
    return res.status(200).json({
      success: true,
      message: "Friend removed",
      ...result,
    });
  } catch (error) {
    return handleFriendError(res, error, "Unable to remove friend");
  }
};

export const countFriends = async (req, res) => {
  try {
    console.info("[friends:controller] countFriends", {
      currentUser: req.userid,
    });
    const friendCount = await getFriendCount(req.userid);
    return res.status(200).json({ success: true, friendCount });
  } catch (error) {
    return handleFriendError(res, error, "Unable to load friend count");
  }
};
