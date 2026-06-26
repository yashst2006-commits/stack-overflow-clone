import express from "express";
import {
  createPostController,
  getFeedController,
  getPostByIdController,
  deletePostController,
  likePostController,
  unlikePostController,
  getLikesController,
  addCommentController,
  getCommentsController,
  deleteCommentController,
  sharePostController,
  getSharedPostsController,
  getShareInfoController,
  getPostingStatusController,
} from "../controller/post.js";
import auth from "../middleware/auth.js";
import { upload } from "../services/uploadService.js";

const router = express.Router();

// Wrapper to handle Multer upload validation errors gracefully
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      console.warn("[post:routes] Upload validation error:", err.message);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  });
};

router.post("/create", auth, handleUpload, createPostController);
router.get("/posting-status", auth, getPostingStatusController);
router.get("/feed", getFeedController);
router.get("/:id", getPostByIdController);
router.delete("/:id", auth, deletePostController);

// Like system endpoints
router.post("/:postId/like", auth, likePostController);
router.delete("/:postId/like", auth, unlikePostController);
router.get("/:postId/likes", getLikesController);

// Comment system endpoints
router.post("/:postId/comments", auth, addCommentController);
router.get("/:postId/comments", getCommentsController);
router.delete("/:postId/comments/:commentId", auth, deleteCommentController);

// Share system endpoints
router.post("/:postId/share", auth, sharePostController);
router.get("/shared", getSharedPostsController);
router.get("/:postId/share-info", getShareInfoController);

export default router;
