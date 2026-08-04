import mongoose from "mongoose";
import { getFriendCount } from "./friend.js";

// Define Mongoose Schema for Comment
const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
}, { timestamps: true });

// Define Mongoose Schema for Post
const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  authorName: { type: String, required: true, trim: true },
  caption: { type: String, default: null, trim: true },
  imageUrl: { type: String, default: null },
  videoUrl: { type: String, default: null },
  imagePublicId: { type: String, default: null },
  videoPublicId: { type: String, default: null },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
  comments: [commentSchema],
  
  // Sharing fields
  isShared: { type: Boolean, default: false },
  originalPostId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
  originalAuthorId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  originalAuthor: { type: String, default: null, trim: true },
  shareCaption: { type: String, default: null, trim: true },
  shareCount: { type: Number, default: 0 },
  
  visibility: { type: String, default: "public", trim: true },
}, { timestamps: true });

postSchema.index({ author: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ visibility: 1 });

const PostModel = mongoose.models.Post || mongoose.model("Post", postSchema);

// Map MongoDB Post document to Frontend expected object
const mapPostToFrontend = (p) => {
  if (!p) return null;

  let imageUrl = p.imageUrl;
  if (imageUrl && imageUrl.startsWith("http")) {
    imageUrl = `/posts/cloudinary-resource?url=${encodeURIComponent(imageUrl)}`;
  }

  let videoUrl = p.videoUrl;
  if (videoUrl && videoUrl.startsWith("http")) {
    videoUrl = `/posts/cloudinary-resource?url=${encodeURIComponent(videoUrl)}`;
  }

  return {
    id: p._id.toString(),
    userId: p.author ? p.author.toString() : "",
    username: p.authorName || "",
    caption: p.caption,
    imageUrl,
    videoUrl,
    imagePublicId: p.imagePublicId || null,
    videoPublicId: p.videoPublicId || null,
    likes: (p.likes || []).map((likeId) => likeId.toString()),
    comments: (p.comments || []).map((c) => ({
      id: c._id ? c._id.toString() : "",
      userId: c.userId ? c.userId.toString() : "",
      username: c.username || "",
      text: c.text,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    })),
    isShared: p.isShared || false,
    originalPostId: p.originalPostId ? p.originalPostId.toString() : null,
    originalAuthorId: p.originalAuthorId ? p.originalAuthorId.toString() : null,
    originalAuthor: p.originalAuthor || null,
    shareCaption: p.shareCaption || null,
    shareCount: p.shareCount || 0,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
};

// Create a post
export const createPost = async ({
  userId,
  username,
  caption = null,
  imageUrl = null,
  videoUrl = null,
  imagePublicId = null,
  videoPublicId = null,
}) => {
  const newPost = await PostModel.create({
    author: new mongoose.Types.ObjectId(userId.trim()),
    authorName: username,
    caption,
    imageUrl,
    videoUrl,
    imagePublicId,
    videoPublicId,
    likes: [],
    comments: [],
    isShared: false,
    shareCount: 0,
  });
  return mapPostToFrontend(newPost);
};

// Get all posts (newest first)
export const getAllPosts = async () => {
  const mongoPosts = await PostModel.find().sort({ createdAt: -1 }).lean();
  return mongoPosts.map(mapPostToFrontend);
};

// Get post by ID
export const getPostById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  const p = await PostModel.findById(id);
  return mapPostToFrontend(p);
};

// Delete post by ID
export const deletePost = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return false;
  }
  const result = await PostModel.findByIdAndDelete(id);
  return !!result;
};

// Helper function to find a post
export const findPost = async (postId) => {
  return await getPostById(postId);
};

// Reusable/no-op helper to save posts (not needed for direct DB mutations, but kept for compatibility)
export const savePosts = async (posts) => {
  // Database updates are persisted directly in methods, no-op here
};

// Like a post
export const likePost = async (postId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const err = new Error("Invalid post ID");
    err.statusCode = 400;
    throw err;
  }
  const userObjectId = new mongoose.Types.ObjectId(userId.trim());

  const p = await PostModel.findById(postId);
  if (!p) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }

  const alreadyLiked = p.likes.some((id) => id.toString() === userObjectId.toString());
  if (alreadyLiked) {
    const err = new Error("Already liked");
    err.statusCode = 400;
    throw err;
  }

  p.likes.push(userObjectId);
  await p.save();
  return p.likes.length;
};

// Unlike a post
export const unlikePost = async (postId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const err = new Error("Invalid post ID");
    err.statusCode = 400;
    throw err;
  }
  const userObjectId = new mongoose.Types.ObjectId(userId.trim());

  const p = await PostModel.findById(postId);
  if (!p) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }

  const isLiked = p.likes.some((id) => id.toString() === userObjectId.toString());
  if (!isLiked) {
    const err = new Error("Not previously liked");
    err.statusCode = 400;
    throw err;
  }

  p.likes = p.likes.filter((id) => id.toString() !== userObjectId.toString());
  await p.save();
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
  return likes.includes(userId.trim());
};

// Add comment to a post
export const addComment = async (postId, { userId, username, text }) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const err = new Error("Invalid post ID");
    err.statusCode = 400;
    throw err;
  }

  const p = await PostModel.findById(postId);
  if (!p) {
    const err = new Error("Post not found");
    err.statusCode = 404;
    throw err;
  }

  const newComment = {
    userId: new mongoose.Types.ObjectId(userId.trim()),
    username,
    text,
  };

  p.comments.push(newComment);
  await p.save();
  
  const created = p.comments[p.comments.length - 1];
  return {
    id: created._id.toString(),
    userId: created.userId.toString(),
    username: created.username,
    text: created.text,
    createdAt: created.createdAt.toISOString(),
  };
};

// Delete comment from a post
export const deleteComment = async (postId, commentId) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    const err = new Error("Invalid post ID");
    err.statusCode = 400;
    throw err;
  }

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
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return 0;
  }
  const p = await PostModel.findById(postId);
  if (p) {
    p.shareCount = (p.shareCount || 0) + 1;
    await p.save();
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

  const newShare = await PostModel.create({
    author: new mongoose.Types.ObjectId(userId.trim()),
    authorName: username,
    isShared: true,
    originalPostId: new mongoose.Types.ObjectId(origPost.id),
    originalAuthorId: new mongoose.Types.ObjectId(origPost.userId),
    originalAuthor: origPost.username,
    shareCaption: shareCaption || null,
    likes: [],
    comments: [],
    shareCount: 0,
  });

  return {
    sharedPost: mapPostToFrontend(newShare),
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

  const allShares = await PostModel.find({
    isShared: true,
    originalPostId: new mongoose.Types.ObjectId(postId),
  }).sort({ createdAt: -1 });

  const sharedBy = allShares.map((p) => ({
    userId: p.author ? p.author.toString() : "",
    username: p.authorName,
    sharedAt: p.createdAt.toISOString(),
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
  const todayStr = getLocalDateString(new Date(), timezone);
  const userObjectId = new mongoose.Types.ObjectId(userId.trim());

  const mongoPosts = await PostModel.find({
    author: userObjectId,
    isShared: { $ne: true },
  });

  const todaysPosts = mongoPosts.filter((p) => {
    return getLocalDateString(p.createdAt, timezone) === todayStr;
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
  const [friendCount, postsToday] = await Promise.all([
    getAcceptedFriendCount(userId),
    countTodaysPosts(userId, timezone),
  ]);
  const dailyLimit = calculateDailyLimit(friendCount);

  return {
    allowed: dailyLimit === null || postsToday < dailyLimit,
    friendCount,
    dailyLimit,
    postsToday,
  };
};

// Get general posting status
export const getPostingStatus = async (userId, timezone) => {
  const [friendCount, postsToday] = await Promise.all([
    getAcceptedFriendCount(userId),
    countTodaysPosts(userId, timezone),
  ]);
  const dailyLimit = calculateDailyLimit(friendCount);
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
export { PostModel };
