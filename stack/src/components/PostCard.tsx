import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Trash2,
  Film,
  Image as ImageIcon,
  Heart,
  MessageSquare,
  Share2,
} from "lucide-react";
import { toast } from "react-toastify";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import {
  deletePost,
  getPostErrorMessage,
  likePost,
  unlikePost,
  getPostById,
  type Post,
} from "@/services/postService";
import CommentSection from "./CommentSection";
import ShareDialog from "./ShareDialog";

interface PostCardProps {
  post: Post;
  onPostDeleted: () => void;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function PostCard({ post, onPostDeleted }: PostCardProps) {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  // States for Likes and Comments
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // States for Shares
  const [shareCount, setShareCount] = useState(0);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // States for nested shared post resolution
  const [origPost, setOrigPost] = useState<Post | null>(null);
  const [origLoading, setOrigLoading] = useState(false);
  const [origError, setOrigError] = useState(false);

  const backendUrl = (
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"
  ).replace(/\/+$/, "");

  // Sync likes, comments, and shares state with post prop
  useEffect(() => {
    const postLikes = post.likes || [];
    setLikeCount(postLikes.length);
    if (user && user._id) {
      setLiked(postLikes.includes(String(user._id)));
    } else {
      setLiked(false);
    }

    const postComments = post.comments || [];
    setCommentCount(postComments.length);

    setShareCount(post.shareCount || 0);
  }, [post, user]);

  // Resolve original post details for shared posts
  useEffect(() => {
    const origId = post.originalPostId;
    if (post.isShared && origId) {
      const loadOriginal = async () => {
        setOrigLoading(true);
        setOrigError(false);
        try {
          const res = await getPostById(origId);
          setOrigPost(res);
        } catch (err) {
          console.error("[PostCard] Error loading original post details", err);
          setOrigError(true);
        } finally {
          setOrigLoading(false);
        }
      };
      loadOriginal();
    } else {
      setOrigPost(null);
    }
  }, [post.isShared, post.originalPostId]);

  // Check if current user is owner of the post
  const isOwner = user && String(user._id) === String(post.userId);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePost(post.id);
      toast.success("Post deleted successfully.");
      window.dispatchEvent(new Event("post-changed"));
      onPostDeleted();
    } catch (err) {
      const errMsg = getPostErrorMessage(err, "Failed to delete post.");
      toast.error(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Like / Unlike toggle handler (Optimistic UI updates)
  const handleLikeToggle = async () => {
    if (!user) {
      toast.warn("Please log in to like posts.");
      return;
    }

    const wasLiked = liked;
    const prevCount = likeCount;

    // 1. Update UI optimistically
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? prevCount - 1 : prevCount + 1);

    try {
      if (wasLiked) {
        // Send unlike API request
        const res = await unlikePost(post.id);
        setLikeCount(res.totalLikes);
        setLiked(false);
      } else {
        // Send like API request
        const res = await likePost(post.id);
        setLikeCount(res.totalLikes);
        setLiked(true);
      }
    } catch (err) {
      // 2. Rollback UI state on error
      setLiked(wasLiked);
      setLikeCount(prevCount);

      const errMsg = getPostErrorMessage(err, "Failed to update like status.");
      toast.error(errMsg);
    }
  };

  const handleShareClick = () => {
    if (!user) {
      toast.warn("Please log in to share posts.");
      return;
    }
    setIsShareOpen(true);
  };

  const handleShareSuccess = (newShares: number) => {
    setShareCount(newShares);
    onPostDeleted(); // Refreshes public feed immediately to show the new share
  };

  // Format creation date nicely
  const formattedDate = new Date(post.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Card className="border border-gray-200 shadow-xs bg-white rounded-lg hover:shadow-sm transition-shadow duration-200">
      {/* Header section */}
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <Link href={`/users/${post.userId}`} className="flex-shrink-0 group">
            <Avatar className="h-10 w-10 border border-orange-100 group-hover:border-orange-300 transition-colors">
              <AvatarFallback className="bg-orange-50 font-bold text-orange-700">
                {getInitials(post.username || "User")}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0">
            <div className="text-sm text-gray-800 block">
              <Link
                href={`/users/${post.userId}`}
                className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
              >
                {post.username}
              </Link>
              {post.isShared && (
                <span className="text-gray-500 font-medium ml-1">
                  shared a post by{" "}
                  <Link
                    href={`/users/${post.originalAuthorId}`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {post.originalAuthor}
                  </Link>
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-400 block mt-0.5">
              {formattedDate}
            </span>
          </div>
        </div>

        {isOwner && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full h-8 w-8 transition-colors"
            title="Delete post"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-2">
        {/* Render Share caption (Alice's commentary) or main Caption */}
        {post.isShared ? (
          post.shareCaption && (
            <p className="text-gray-900 text-sm font-semibold whitespace-pre-wrap break-words leading-relaxed mb-3.5">
              {post.shareCaption}
            </p>
          )
        ) : (
          post.caption && (
            <p className="text-gray-800 text-sm whitespace-pre-wrap break-words leading-relaxed mb-3">
              {post.caption}
            </p>
          )
        )}

        {/* Nested Box for Original Post Content */}
        {post.isShared && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 mt-1 mb-3 text-left">
            {origLoading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-orange-500"></div>
                <span className="text-xs text-gray-400">Loading original post...</span>
              </div>
            ) : origError || (!origPost && !origLoading) ? (
              <div className="rounded border border-dashed border-red-100 bg-red-50/30 text-red-700/80 text-center py-4 text-xs font-semibold italic">
                [Original post has been deleted by its author]
              </div>
            ) : (
              origPost && (
                <div className="space-y-2">
                  {/* Original Author header */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="font-bold text-gray-800">
                      {origPost.username}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(origPost.createdAt).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </span>
                  </div>

                  {/* Original post body */}
                  {origPost.caption && (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap break-words leading-normal">
                      {origPost.caption}
                    </p>
                  )}

                  {origPost.imageUrl && (
                    <div className="overflow-hidden rounded border border-gray-100 bg-white max-h-[300px] flex items-center justify-center mt-2">
                      <img
                        src={`${backendUrl}${origPost.imageUrl}`}
                        alt="Original attachment"
                        className="max-h-[300px] w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {origPost.videoUrl && (
                    <div className="overflow-hidden rounded border border-gray-100 bg-black max-h-[300px] flex items-center justify-center mt-2">
                      <video
                        src={`${backendUrl}${origPost.videoUrl}`}
                        controls
                        className="max-h-[300px] w-full object-contain"
                        preload="metadata"
                      />
                    </div>
                  )}

                  {/* Original Post Stats */}
                  <div className="flex gap-4 pt-2 text-[10px] text-gray-400 font-semibold select-none border-t border-gray-150 mt-3">
                    <span>❤️ {origPost.likes?.length || 0} Likes</span>
                    <span>💬 {origPost.comments?.length || 0} Comments</span>
                    <span>🔄 {origPost.shareCount || 0} Shares</span>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Render image / video attachments for original posts only */}
        {!post.isShared && post.imageUrl && (
          <div className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50 mb-3 group relative max-h-[450px] flex items-center justify-center">
            <img
              src={`${backendUrl}${post.imageUrl}`}
              alt="Post attachment"
              className="max-h-[450px] w-full object-contain transition-transform duration-200 hover:scale-[1.01]"
              loading="lazy"
            />
          </div>
        )}

        {!post.isShared && post.videoUrl && (
          <div className="overflow-hidden rounded-lg border border-gray-100 bg-black mb-3 max-h-[450px] flex items-center justify-center">
            <video
              src={`${backendUrl}${post.videoUrl}`}
              controls
              className="max-h-[450px] w-full object-contain"
              preload="metadata"
            />
          </div>
        )}

        {/* Action Buttons Section */}
        <div className="flex items-center gap-3 mt-4 border-t border-gray-100 pt-3 flex-wrap">
          {/* Like button */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLikeToggle}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold select-none transition-all active:scale-95 duration-100 ${
                liked
                  ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                  : "text-gray-500 hover:text-red-600 hover:bg-red-50"
              }`}
            >
              <Heart
                className={`w-4 h-4 transition-transform active:scale-125 duration-100 ${
                  liked ? "fill-red-500 text-red-500" : "text-gray-500"
                }`}
              />
              <span>{liked ? "Liked" : "Like"}</span>
            </Button>

            <span className="text-xs text-gray-500 font-semibold select-none mr-2">
              {likeCount} {likeCount === 1 ? "Like" : "Likes"}
            </span>
          </div>

          <span className="h-4 w-px bg-gray-200 hidden sm:inline-block" />

          {/* Comment button */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold select-none transition-all duration-100 ${
                showComments
                  ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  : "text-gray-500 hover:text-blue-600 hover:bg-blue-50"
              }`}
            >
              <MessageSquare
                className={`w-4 h-4 transition-transform ${
                  showComments ? "fill-blue-500/10 text-blue-500" : "text-gray-500"
                }`}
              />
              <span>Comment</span>
            </Button>

            <span className="text-xs text-gray-500 font-semibold select-none mr-2">
              {commentCount} {commentCount === 1 ? "Comment" : "Comments"}
            </span>
          </div>

          <span className="h-4 w-px bg-gray-200 hidden sm:inline-block" />

          {/* Share button */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleShareClick}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold select-none text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-all duration-105"
            >
              <Share2 className="w-4 h-4 text-gray-500" />
              <span>Share</span>
            </Button>

            <span className="text-xs text-gray-500 font-semibold select-none">
              {shareCount} {shareCount === 1 ? "Share" : "Shares"}
            </span>
          </div>
        </div>

        {/* Comment Section container */}
        {showComments && (
          <CommentSection
            postId={post.id}
            initialCount={commentCount}
            onCountUpdated={setCommentCount}
          />
        )}
      </CardContent>

      {/* Share Dialog Trigger */}
      <ShareDialog
        post={post}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        onShareSuccess={handleShareSuccess}
      />
    </Card>
  );
}
