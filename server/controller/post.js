import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import user from "../models/auth.js";
import {
  createPost,
  getAllPosts,
  getPostById,
  deletePost,
  likePost,
  unlikePost,
  getLikes,
  hasUserLiked,
  findPost,
  addComment,
  deleteComment,
  getComments,
  findComment,
  sharePost,
  getSharedPosts,
  getShareInfo,
  incrementShareCount,
  findOriginalPost,
  canUserCreatePost,
  getPostingStatus,
} from "../models/post.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to delete files from the disk
const deleteDiskFile = async (relativeUrl) => {
  if (!relativeUrl) return;
  try {
    const filePath = path.join(__dirname, "..", relativeUrl);
    await fs.unlink(filePath);
    console.info(`[post:controller] Disk file deleted: ${filePath}`);
  } catch (error) {
    console.error(`[post:controller] Error deleting file ${relativeUrl}:`, error.message);
  }
};

// Helper to clean up newly uploaded files in req.files
const cleanupUploadedFiles = async (files) => {
  if (!files) return;
  if (files.image && files.image[0]) {
    try {
      await fs.unlink(files.image[0].path);
      console.info(`[post:controller] Cleaned up image file: ${files.image[0].path}`);
    } catch (e) {
      console.error("[post:controller] Failed to cleanup image file", e.message);
    }
  }
  if (files.video && files.video[0]) {
    try {
      await fs.unlink(files.video[0].path);
      console.info(`[post:controller] Cleaned up video file: ${files.video[0].path}`);
    } catch (e) {
      console.error("[post:controller] Failed to cleanup video file", e.message);
    }
  }
};

// Helper to fetch username (display name) by userId
const getUserName = async (userId) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  if (isMongoConnected) {
    try {
      const matchedUser = await user.findById(userId);
      return matchedUser ? matchedUser.name : "Unknown User";
    } catch (e) {
      console.error("[post:controller] MongoDB getUserName error", e.message);
      return "Unknown User";
    }
  }

  try {
    const usersFile = path.join(__dirname, "..", "data", "users.json");
    const content = await fs.readFile(usersFile, "utf8");
    const users = JSON.parse(content);
    const matchedUser = users.find((u) => String(u._id) === String(userId));
    return matchedUser ? matchedUser.name : "Unknown User";
  } catch (e) {
    console.error("[post:controller] JSON getUserName error", e.message);
    return "Unknown User";
  }
};

// Helper to parse optional user ID from request headers (for public like fetching)
const getOptionalUserId = (req) => {
  try {
    const authorization = req.headers.authorization;
    if (authorization && authorization.startsWith("Bearer ")) {
      const token = authorization.slice("Bearer ".length).trim();
      if (token) {
        const decodedata = jwt.verify(token, process.env.JWT_SECRET);
        return decodedata?.id ? String(decodedata.id) : null;
      }
    }
  } catch (error) {
    // Ignore verification errors for optional auth
  }
  return null;
};

// Create Post Controller
export const createPostController = async (req, res) => {
  const { caption } = req.body;
  const files = req.files;

  try {
    // 1. Authenticate user validation (handled in auth middleware, but check req.userid)
    if (!req.userid) {
      await cleanupUploadedFiles(files);
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    // 1.5. Validate daily posting limits based on friend count
    const timezone = req.query.timezone || req.headers["x-timezone"] || "UTC";
    const check = await canUserCreatePost(req.userid, timezone);
    if (!check.allowed) {
      await cleanupUploadedFiles(files);
      if (check.friendCount === 0) {
        return res.status(403).json({
          success: false,
          message: "You need at least one accepted friend before posting publicly.",
          friendCount: 0,
        });
      }
      return res.status(403).json({
        success: false,
        message: "Daily posting limit reached.",
        friendCount: check.friendCount,
        dailyLimit: check.dailyLimit,
        postsToday: check.postsToday,
      });
    }

    // 2. Validate empty request
    const hasImage = files && files.image && files.image[0];
    const hasVideo = files && files.video && files.video[0];
    const hasCaption = caption && caption.trim().length > 0;

    if (!hasCaption && !hasImage && !hasVideo) {
      await cleanupUploadedFiles(files);
      return res.status(400).json({
        success: false,
        message: "Post must contain a caption, an image, or a video.",
      });
    }

    // 3. File Size Validation
    if (hasImage) {
      const imageSize = files.image[0].size;
      if (imageSize > 5 * 1024 * 1024) {
        await cleanupUploadedFiles(files);
        return res.status(400).json({
          success: false,
          message: "Image size must be less than 5 MB",
        });
      }
    }

    if (hasVideo) {
      const videoSize = files.video[0].size;
      if (videoSize > 50 * 1024 * 1024) {
        await cleanupUploadedFiles(files);
        return res.status(400).json({
          success: false,
          message: "Video size must be less than 50 MB",
        });
      }
    }

    // 4. Resolve relative URLs for database/JSON storage
    const imageUrl = hasImage ? `/uploads/images/${files.image[0].filename}` : null;
    const videoUrl = hasVideo ? `/uploads/videos/${files.video[0].filename}` : null;

    // 5. Fetch display username
    const username = await getUserName(req.userid);

    // 6. Create post
    const post = await createPost({
      userId: req.userid,
      username,
      caption: hasCaption ? caption.trim() : null,
      imageUrl,
      videoUrl,
    });

    console.info("[post:controller] Post created successfully", {
      postId: post.id,
      userId: post.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: post,
    });
  } catch (error) {
    await cleanupUploadedFiles(files);
    console.error("[post:controller] Error creating post", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong during post creation",
    });
  }
};

// Get Feed Controller
export const getFeedController = async (req, res) => {
  try {
    const posts = await getAllPosts();
    return res.status(200).json({
      success: true,
      data: posts,
    });
  } catch (error) {
    console.error("[post:controller] Error fetching feed", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while loading feed",
    });
  }
};

// Get Post by ID Controller
export const getPostByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const post = await getPostById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error("[post:controller] Error getting post by ID", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving post",
    });
  }
};

// Delete Post Controller
export const deletePostController = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Authenticate user validation
    if (!req.userid) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    // 2. Fetch post
    const post = await getPostById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // 3. Prevent unauthorized deletion
    if (String(post.userId) !== String(req.userid)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this post",
      });
    }

    // 4. Delete files from disk first
    if (post.imageUrl) {
      await deleteDiskFile(post.imageUrl);
    }
    if (post.videoUrl) {
      await deleteDiskFile(post.videoUrl);
    }

    // 5. Delete post entry
    const isDeleted = await deletePost(id);
    if (!isDeleted) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete post",
      });
    }

    console.info("[post:controller] Post deleted successfully", {
      postId: id,
      deletedBy: req.userid,
    });

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("[post:controller] Error deleting post", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while deleting post",
    });
  }
};

// Like Post Controller
export const likePostController = async (req, res) => {
  const { postId } = req.params;
  const userId = req.userid;

  try {
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    // Check if post exists
    const post = await findPost(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const totalLikes = await likePost(postId, userId);
    return res.status(200).json({
      success: true,
      liked: true,
      totalLikes,
    });
  } catch (error) {
    console.error("[post:controller] Error liking post", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Something went wrong while liking post",
    });
  }
};

// Unlike Post Controller
export const unlikePostController = async (req, res) => {
  const { postId } = req.params;
  const userId = req.userid;

  try {
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    // Check if post exists
    const post = await findPost(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const totalLikes = await unlikePost(postId, userId);
    return res.status(200).json({
      success: true,
      liked: false,
      totalLikes,
    });
  } catch (error) {
    console.error("[post:controller] Error unliking post", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Something went wrong while unliking post",
    });
  }
};

// Get Likes Info Controller (totalCount and if current user liked it)
export const getLikesController = async (req, res) => {
  const { postId } = req.params;

  try {
    const post = await findPost(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const userId = getOptionalUserId(req);
    const likes = await getLikes(postId);
    const likedByCurrentUser = userId ? likes.includes(userId) : false;

    return res.status(200).json({
      totalLikes: likes.length,
      likedByCurrentUser,
    });
  } catch (error) {
    console.error("[post:controller] Error getting likes", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Something went wrong while fetching likes info",
    });
  }
};

// Add Comment Controller
export const addCommentController = async (req, res) => {
  const { postId } = req.params;
  const { text } = req.body;
  const userId = req.userid;

  try {
    // 1. Enforce user authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    // 2. Validate post exists
    const post = await findPost(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // 3. Validate comment input
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty",
      });
    }

    if (text.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 500 characters",
      });
    }

    // 4. Fetch display name
    const username = await getUserName(userId);

    // 5. Add comment
    const comment = await addComment(postId, {
      userId,
      username,
      text: text.trim(),
    });

    // 6. Fetch total comments count
    const totalComments = (await getComments(postId)).length;

    console.info("[post:controller] Comment added", {
      postId,
      commentId: comment.id,
      userId,
    });

    return res.status(201).json({
      success: true,
      comment,
      totalComments,
    });
  } catch (error) {
    console.error("[post:controller] Error adding comment", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Something went wrong while adding comment",
    });
  }
};

// Get Comments Controller
export const getCommentsController = async (req, res) => {
  const { postId } = req.params;

  try {
    // 1. Validate post exists
    const post = await findPost(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // 2. Fetch sorted comments
    const comments = await getComments(postId);

    return res.status(200).json({
      totalComments: comments.length,
      comments,
    });
  } catch (error) {
    console.error("[post:controller] Error getting comments", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Something went wrong while loading comments",
    });
  }
};

// Delete Comment Controller
export const deleteCommentController = async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.userid;

  try {
    // 1. Enforce user authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    // 2. Validate post exists
    const post = await findPost(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // 3. Find target comment to verify ownership
    const comment = await findComment(postId, commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // 4. Validate ownership
    if (String(comment.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this comment",
      });
    }

    // 5. Delete comment
    const totalComments = await deleteComment(postId, commentId);

    console.info("[post:controller] Comment deleted", {
      postId,
      commentId,
      deletedBy: userId,
    });

    return res.status(200).json({
      success: true,
      totalComments,
    });
  } catch (error) {
    console.error("[post:controller] Error deleting comment", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Something went wrong while deleting comment",
    });
  }
};

// Share Post Controller
export const sharePostController = async (req, res) => {
  const { postId } = req.params;
  const { shareCaption, confirm } = req.body;
  const userId = req.userid;

  try {
    // 1. Enforce user authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    // 2. Validate original post exists
    const post = await findOriginalPost(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Original post not found",
      });
    }

    // 3. Prevent duplicate shares without explicit confirm flag
    const allPosts = await getAllPosts();
    const alreadyShared = allPosts.some(
      (p) =>
        p.isShared === true &&
        String(p.originalPostId) === String(postId) &&
        String(p.userId) === String(userId)
    );

    if (alreadyShared && confirm !== true) {
      return res.status(400).json({
        success: false,
        requiresConfirmation: true,
        message: "You have already shared this post. Share it again?",
      });
    }

    // 4. Fetch display name
    const username = await getUserName(userId);

    // 5. Create shared post
    const result = await sharePost(postId, userId, username, shareCaption);

    console.info("[post:controller] Post shared", {
      postId,
      sharedPostId: result.sharedPost.id,
      userId,
    });

    return res.status(201).json({
      success: true,
      sharedPost: result.sharedPost,
      totalShares: result.totalShares,
    });
  } catch (error) {
    console.error("[post:controller] Error sharing post", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Something went wrong while sharing post",
    });
  }
};

// Get Shared Posts Controller
export const getSharedPostsController = async (req, res) => {
  try {
    const sharedPosts = await getSharedPosts();
    return res.status(200).json({
      success: true,
      data: sharedPosts,
    });
  } catch (error) {
    console.error("[post:controller] Error fetching shared posts", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while loading shared posts",
    });
  }
};

// Get Share Info Controller
export const getShareInfoController = async (req, res) => {
  const { postId } = req.params;

  try {
    // Validate post exists
    const post = await findOriginalPost(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Original post not found",
      });
    }

    const result = await getShareInfo(postId);

    return res.status(200).json({
      totalShares: result.totalShares,
      sharedBy: result.sharedBy,
    });
  } catch (error) {
    console.error("[post:controller] Error fetching share info", error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Something went wrong while loading share info",
    });
  }
};

// Get Posting Status Controller
export const getPostingStatusController = async (req, res) => {
  const userId = req.userid;
  const timezone = req.query.timezone || req.headers["x-timezone"] || "UTC";

  try {
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    const status = await getPostingStatus(userId, timezone);
    return res.status(200).json(status);
  } catch (error) {
    console.error("[post:controller] Error retrieving posting status", error.message);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while retrieving posting status",
    });
  }
};
