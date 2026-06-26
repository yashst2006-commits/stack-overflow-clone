import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { getFriendCount } from "./friend.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const postsFile = path.join(currentDirectory, "..", "data", "posts.json");

const isMongoConnected = () => mongoose.connection.readyState === 1;

// Define Mongoose Schema for Comment
const commentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Define Mongoose Schema for Post (Extended with likes, comments, and sharing fields)
const postSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  caption: { type: String, default: null },
  imageUrl: { type: String, default: null },
  videoUrl: { type: String, default: null },
  likes: { type: [String], default: [] },
  comments: { type: [commentSchema], default: [] },
  
  // Sharing fields
  isShared: { type: Boolean, default: false },
  originalPostId: { type: String, default: null },
  originalAuthorId: { type: String, default: null },
  originalAuthor: { type: String, default: null },
  shareCaption: { type: String, default: null },
  shareCount: { type: Number, default: 0 },
  
  createdAt: { type: Date, default: Date.now },
});

const PostModel = mongoose.models.Post || mongoose.model("Post", postSchema);

// Read local JSON posts (with migration/safeguard for missing array structures)
export const readPosts = async () => {
  try {
    const content = await fs.readFile(postsFile, "utf8");
    const posts = JSON.parse(content);
    return posts.map((p) => ({
      ...p,
      likes: p.likes || [],
      comments: (p.comments || []).map((c) => ({
        ...c,
        id: c.id || `comment_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        createdAt: c.createdAt || new Date().toISOString(),
      })),
      isShared: p.isShared || false,
      originalPostId: p.originalPostId || null,
      originalAuthorId: p.originalAuthorId || null,
      originalAuthor: p.originalAuthor || null,
      shareCaption: p.shareCaption || null,
      shareCount: p.shareCount || 0,
    }));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

// Write local JSON posts
export const writePosts = async (posts) => {
  await fs.mkdir(path.dirname(postsFile), { recursive: true });
  await fs.writeFile(postsFile, JSON.stringify(posts, null, 2));
};

// Create a post
export const createPost = async ({
  userId,
  username,
  caption = null,
  imageUrl = null,
  videoUrl = null,
}) => {
  if (isMongoConnected()) {
    const newPost = await PostModel.create({
      userId,
      username,
      caption,
      imageUrl,
      videoUrl,
      likes: [],
      comments: [],
      isShared: false,
      shareCount: 0,
    });
    return {
      id: newPost._id.toString(),
      userId: newPost.userId,
      username: newPost.username,
      caption: newPost.caption,
      imageUrl: newPost.imageUrl,
      videoUrl: newPost.videoUrl,
      likes: [],
      comments: [],
      isShared: false,
      originalPostId: null,
      originalAuthorId: null,
      originalAuthor: null,
      shareCaption: null,
      shareCount: 0,
      createdAt: newPost.createdAt.toISOString(),
    };
  }

  const posts = await readPosts();
  const newPost = {
    id: `post_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId,
    username,
    caption,
    imageUrl,
    videoUrl,
    likes: [],
    comments: [],
    isShared: false,
    originalPostId: null,
    originalAuthorId: null,
    originalAuthor: null,
    shareCaption: null,
    shareCount: 0,
    createdAt: new Date().toISOString(),
  };

  posts.push(newPost);
  await writePosts(posts);
  return newPost;
};

// Get all posts (newest first)
export const getAllPosts = async () => {
  if (isMongoConnected()) {
    const mongoPosts = await PostModel.find().sort({ createdAt: -1 });
    return mongoPosts.map((p) => ({
      id: p._id.toString(),
      userId: p.userId,
      username: p.username,
      caption: p.caption,
      imageUrl: p.imageUrl,
      videoUrl: p.videoUrl,
      likes: p.likes || [],
      comments: (p.comments || []).map((c) => ({
        id: c._id ? c._id.toString() : c.id,
        userId: c.userId,
        username: c.username,
        text: c.text,
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      })),
      isShared: p.isShared || false,
      originalPostId: p.originalPostId || null,
      originalAuthorId: p.originalAuthorId || null,
      originalAuthor: p.originalAuthor || null,
      shareCaption: p.shareCaption || null,
      shareCount: p.shareCount || 0,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  const posts = await readPosts();
  return [...posts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

// Get post by ID
export const getPostById = async (id) => {
  if (isMongoConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const p = await PostModel.findById(id);
    if (!p) return null;
    return {
      id: p._id.toString(),
      userId: p.userId,
      username: p.username,
      caption: p.caption,
      imageUrl: p.imageUrl,
      videoUrl: p.videoUrl,
      likes: p.likes || [],
      comments: (p.comments || []).map((c) => ({
        id: c._id ? c._id.toString() : c.id,
        userId: c.userId,
        username: c.username,
        text: c.text,
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      })),
      isShared: p.isShared || false,
      originalPostId: p.originalPostId || null,
      originalAuthorId: p.originalAuthorId || null,
      originalAuthor: p.originalAuthor || null,
      shareCaption: p.shareCaption || null,
      shareCount: p.shareCount || 0,
      createdAt: p.createdAt.toISOString(),
    };
  }

  const posts = await readPosts();
  const matched = posts.find((p) => p.id === id);
  if (matched) {
    matched.likes = matched.likes || [];
    matched.comments = matched.comments || [];
    matched.isShared = matched.isShared || false;
    matched.shareCount = matched.shareCount || 0;
  }
  return matched || null;
};

// Delete post by ID
export const deletePost = async (id) => {
  if (isMongoConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await PostModel.findByIdAndDelete(id);
    return !!result;
  }

  const posts = await readPosts();
  const index = posts.findIndex((p) => p.id === id);
  if (index === -1) {
    return false;
  }
  posts.splice(index, 1);
  await writePosts(posts);
  return true;
};

// Helper function to find a post
export const findPost = async (postId) => {
  return await getPostById(postId);
};

// Helper function to save posts
export const savePosts = async (posts) => {
  await writePosts(posts);
};

// Like a post
export const likePost = async (postId, userId) => {
  if (isMongoConnected()) {
    const p = await PostModel.findById(postId);
    if (!p) {
      const err = new Error("Post not found");
      err.statusCode = 404;
      throw err;
    }
    if (p.likes.includes(userId)) {
      const err = new Error("Already liked");
      err.statusCode = 400;
      throw err;
    }
    p.likes.push(userId);
    await p.save();
    return p.likes.length;
  }

  const posts = await readPosts();
  const pIndex = posts.findIndex((item) => item.id === postId);
  if (pIndex === -1) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }
  const p = posts[pIndex];
  p.likes = p.likes || [];
  if (p.likes.includes(userId)) {
    const err = new Error("Already liked");
    err.statusCode = 400;
    throw err;
  }
  p.likes.push(userId);
  await writePosts(posts);
  return p.likes.length;
};

// Unlike a post
export const unlikePost = async (postId, userId) => {
  if (isMongoConnected()) {
    const p = await PostModel.findById(postId);
    if (!p) {
      const err = new Error("Post not found");
      err.statusCode = 404;
      throw err;
    }
    if (!p.likes.includes(userId)) {
      const err = new Error("Not previously liked");
      err.statusCode = 400;
      throw err;
    }
    p.likes = p.likes.filter((id) => id !== userId);
    await p.save();
    return p.likes.length;
  }

  const posts = await readPosts();
  const pIndex = posts.findIndex((item) => item.id === postId);
  if (pIndex === -1) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }
  const p = posts[pIndex];
  p.likes = p.likes || [];
  if (!p.likes.includes(userId)) {
    const err = new Error("Not previously liked");
    err.statusCode = 400;
    throw err;
  }
  p.likes = p.likes.filter((id) => id !== userId);
  await writePosts(posts);
  return p.likes.length;
};

// Get Likes array for a post
export const getLikes = async (postId) => {
  const post = await getPostById(postId);
  if (!post) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }
  return post.likes || [];
};

// Check if a user has liked a post
export const hasUserLiked = async (postId, userId) => {
  const likes = await getLikes(postId);
  return likes.includes(userId);
};

// Add comment to a post
export const addComment = async (postId, { userId, username, text }) => {
  if (isMongoConnected()) {
    const p = await PostModel.findById(postId);
    if (!p) {
      const err = new Error("Post not found");
      err.statusCode = 404;
      throw err;
    }
    const newComment = {
      userId,
      username,
      text,
      createdAt: new Date(),
    };
    p.comments.push(newComment);
    await p.save();
    const created = p.comments[p.comments.length - 1];
    return {
      id: created._id.toString(),
      userId: created.userId,
      username: created.username,
      text: created.text,
      createdAt: created.createdAt.toISOString(),
    };
  }

  const posts = await readPosts();
  const pIndex = posts.findIndex((item) => item.id === postId);
  if (pIndex === -1) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }
  const p = posts[pIndex];
  p.comments = p.comments || [];
  const newComment = {
    id: `comment_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId,
    username,
    text,
    createdAt: new Date().toISOString(),
  };
  p.comments.push(newComment);
  await writePosts(posts);
  return newComment;
};

// Delete comment from a post
export const deleteComment = async (postId, commentId) => {
  if (isMongoConnected()) {
    const p = await PostModel.findById(postId);
    if (!p) {
      const err = new Error("Post not found");
      err.statusCode = 404;
      throw err;
    }
    const comment = p.comments.id(commentId);
    if (!comment) {
      const err = new Error("Comment not found");
      err.statusCode = 404;
      throw err;
    }
    p.comments.pull(commentId);
    await p.save();
    return p.comments.length;
  }

  const posts = await readPosts();
  const pIndex = posts.findIndex((item) => item.id === postId);
  if (pIndex === -1) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }
  const p = posts[pIndex];
  p.comments = p.comments || [];
  const cIndex = p.comments.findIndex((c) => String(c.id) === String(commentId));
  if (cIndex === -1) {
    const err = new Error("Comment not found");
    err.statusCode = 404;
    throw err;
  }
  p.comments.splice(cIndex, 1);
  await writePosts(posts);
  return p.comments.length;
};

// Get all comments for a post (sorted oldest first)
export const getComments = async (postId) => {
  const post = await getPostById(postId);
  if (!post) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }
  const comments = post.comments || [];
  return [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
};

// Find a single comment inside a post
export const findComment = async (postId, commentId) => {
  const post = await getPostById(postId);
  if (!post) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }
  const comments = post.comments || [];
  const matched = comments.find((c) => String(c.id) === String(commentId));
  return matched || null;
};

// Increment share count of a post
export const incrementShareCount = async (postId) => {
  if (isMongoConnected()) {
    const p = await PostModel.findById(postId);
    if (p) {
      p.shareCount = (p.shareCount || 0) + 1;
      await p.save();
      return p.shareCount;
    }
    return 0;
  }

  const posts = await readPosts();
  const pIndex = posts.findIndex((item) => item.id === postId);
  if (pIndex !== -1) {
    const p = posts[pIndex];
    p.shareCount = (p.shareCount || 0) + 1;
    await writePosts(posts);
    return p.shareCount;
  }
  return 0;
};

// Find original post (alias for getPostById)
export const findOriginalPost = async (postId) => {
  return await getPostById(postId);
};

// Share a post (creates a new shared post and returns sharedPost & totalShares)
export const sharePost = async (postId, userId, username, shareCaption) => {
  const origPost = await getPostById(postId);
  if (!origPost) {
    const err = new Error("Original post not found");
    err.statusCode = 404;
    throw err;
  }

  // Increment original post's share count
  const totalShares = await incrementShareCount(postId);

  if (isMongoConnected()) {
    const newShare = await PostModel.create({
      userId,
      username,
      isShared: true,
      originalPostId: origPost.id,
      originalAuthorId: origPost.userId,
      originalAuthor: origPost.username,
      shareCaption: shareCaption || null,
      likes: [],
      comments: [],
      shareCount: 0,
    });

    return {
      sharedPost: {
        id: newShare._id.toString(),
        userId: newShare.userId,
        username: newShare.username,
        isShared: true,
        originalPostId: newShare.originalPostId,
        originalAuthorId: newShare.originalAuthorId,
        originalAuthor: newShare.originalAuthor,
        shareCaption: newShare.shareCaption,
        likes: [],
        comments: [],
        shareCount: 0,
        createdAt: newShare.createdAt.toISOString(),
      },
      totalShares,
    };
  }

  const posts = await readPosts();
  const newShare = {
    id: `share_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId,
    username,
    isShared: true,
    originalPostId: origPost.id,
    originalAuthorId: origPost.userId,
    originalAuthor: origPost.username,
    shareCaption: shareCaption || null,
    likes: [],
    comments: [],
    shareCount: 0,
    createdAt: new Date().toISOString(),
  };

  posts.push(newShare);
  await writePosts(posts);

  return {
    sharedPost: newShare,
    totalShares,
  };
};

// Get shared posts
export const getSharedPosts = async () => {
  const posts = await getAllPosts();
  return posts.filter((p) => p.isShared === true);
};

// Get share info (who shared a post)
export const getShareInfo = async (postId) => {
  const post = await getPostById(postId);
  if (!post) {
    const err = new Error("Original post not found");
    err.statusCode = 404;
    throw err;
  }

  const allPosts = await getAllPosts();
  const shares = allPosts.filter(
    (p) => p.isShared === true && String(p.originalPostId) === String(postId)
  );

  const sharedBy = shares.map((p) => ({
    userId: p.userId,
    username: p.username,
    sharedAt: p.createdAt,
  }));

  return {
    totalShares: post.shareCount || 0,
    sharedBy,
  };
};

// Convert date to YYYY-MM-DD string in user's local timezone
export const getLocalDateString = (dateInput, timeZone) => {
  const date = new Date(dateInput);
  if (timeZone) {
    try {
      return date.toLocaleDateString("en-CA", { timeZone });
    } catch (e) {
      // Ignore invalid timezone errors, fallback to default
    }
  }
  return date.toLocaleDateString("en-CA");
};

// Retrieve accepted friend count
export const getAcceptedFriendCount = async (userId) => {
  return await getFriendCount(userId);
};

// Count only original (not shared) posts created today in local timezone
export const countTodaysPosts = async (userId, timezone) => {
  const allPosts = await getAllPosts();
  const todayStr = getLocalDateString(new Date(), timezone);

  const todaysPosts = allPosts.filter((p) => {
    return (
      String(p.userId) === String(userId) &&
      p.isShared !== true &&
      getLocalDateString(p.createdAt, timezone) === todayStr
    );
  });

  return todaysPosts.length;
};

// Calculate daily post limit based on accepted friends count
export const calculateDailyLimit = (friendCount) => {
  if (friendCount === 0) return 0;
  if (friendCount >= 1 && friendCount <= 10) return friendCount;
  return null; // Unlimited for > 10 friends
};

// Check if user is allowed to create post
export const canUserCreatePost = async (userId, timezone) => {
  const friendCount = await getAcceptedFriendCount(userId);
  const dailyLimit = calculateDailyLimit(friendCount);
  
  if (dailyLimit === null) {
    return {
      allowed: true,
      friendCount,
      dailyLimit,
      postsToday: await countTodaysPosts(userId, timezone),
    };
  }

  const postsToday = await countTodaysPosts(userId, timezone);
  return {
    allowed: postsToday < dailyLimit,
    friendCount,
    dailyLimit,
    postsToday,
  };
};

// Get general posting status
export const getPostingStatus = async (userId, timezone) => {
  const friendCount = await getAcceptedFriendCount(userId);
  const dailyLimit = calculateDailyLimit(friendCount);
  const postsToday = await countTodaysPosts(userId, timezone);
  const unlimited = dailyLimit === null;
  const remainingPosts = unlimited ? null : Math.max(0, dailyLimit - postsToday);

  return {
    friendCount,
    dailyLimit,
    postsToday,
    remainingPosts,
    unlimited,
  };
};
