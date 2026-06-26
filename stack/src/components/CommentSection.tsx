import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Send, MessageSquare, AlertCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { addComment, getComments, getPostErrorMessage, type Comment } from "@/services/postService";
import CommentItem from "./CommentItem";

interface CommentSectionProps {
  postId: string;
  initialCount: number;
  onCountUpdated: (newCount: number) => void;
}

export default function CommentSection({
  postId,
  initialCount,
  onCountUpdated,
}: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load comments on mount
  useEffect(() => {
    const loadComments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getComments(postId);
        setComments(res.comments || []);
        onCountUpdated(res.totalComments);
      } catch (err) {
        console.error("[CommentSection] Failed to load comments", err);
        setError(getPostErrorMessage(err, "Failed to load comments."));
      } finally {
        setIsLoading(false);
      }
    };

    loadComments();
  }, [postId]);

  // Handle Comment Submission (Optimistic UI)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.warn("Please log in to add comments.");
      return;
    }

    const trimmedText = inputText.trim();
    if (!trimmedText) {
      toast.error("Comment cannot be empty.");
      return;
    }

    if (trimmedText.length > 500) {
      toast.error("Comment cannot exceed 500 characters.");
      return;
    }

    setIsPosting(true);

    const prevComments = [...comments];
    const prevCount = comments.length;

    // 1. Create a local temporary comment for optimistic update
    const tempComment: Comment = {
      id: `temp_${Date.now()}`,
      userId: String(user._id),
      username: user.name || "You",
      text: trimmedText,
      createdAt: new Date().toISOString(),
    };

    // 2. Apply optimistic updates
    setComments((prev) => [...prev, tempComment]);
    onCountUpdated(prevCount + 1);
    setInputText("");

    try {
      // 3. Send API request
      const res = await addComment(postId, trimmedText);

      // 4. Update with actual comment returned from server
      setComments((prev) =>
        prev.map((c) => (c.id === tempComment.id ? res.comment : c))
      );
      onCountUpdated(res.totalComments);
    } catch (err) {
      // 5. Rollback on error
      setComments(prevComments);
      onCountUpdated(prevCount);
      setInputText(trimmedText); // Restore what user was typing

      const errMsg = getPostErrorMessage(err, "Failed to add comment.");
      toast.error(errMsg);
    } finally {
      setIsPosting(false);
    }
  };

  const handleCommentDeleted = (commentId: string, newTotal: number) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCountUpdated(newTotal);
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4 space-x-2">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-orange-500"></div>
          <span className="text-xs text-gray-500">Loading comments...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-1.5 text-red-600 bg-red-50 p-2.5 rounded-md text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-6 text-gray-400 flex flex-col items-center justify-center">
          <MessageSquare className="w-5 h-5 mb-1.5 opacity-50" />
          <p className="text-xs font-medium">No comments yet</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              postId={postId}
              comment={comment}
              onCommentDeleted={(newTotal) => handleCommentDeleted(comment.id, newTotal)}
            />
          ))}
        </div>
      )}

      {/* Comment Input Box */}
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-2 mt-3">
          <div className="relative">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Write a comment... (max 500 characters)"
              className="text-xs min-h-[60px] pr-2 focus-visible:ring-orange-200 border-gray-200 placeholder-gray-400 text-gray-800"
              disabled={isPosting}
              maxLength={500}
            />
            <span className="absolute bottom-1 right-2 text-[9px] text-gray-400 select-none">
              {500 - inputText.length} characters left
            </span>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isPosting || !inputText.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs flex items-center gap-1 px-3 py-1.5 shadow-xs transition-colors rounded disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              <span>{isPosting ? "Posting..." : "Post Comment"}</span>
            </Button>
          </div>
        </form>
      ) : (
        <div className="bg-gray-50 border border-gray-100 rounded-md p-3 text-center text-xs text-gray-500">
          Please{" "}
          <Link href="/auth" className="text-blue-600 font-semibold hover:underline">
            log in
          </Link>{" "}
          to write comments.
        </div>
      )}
    </div>
  );
}
