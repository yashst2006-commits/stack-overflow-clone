import React, { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { deleteComment, getPostErrorMessage, type Comment } from "@/services/postService";

interface CommentItemProps {
  postId: string;
  comment: Comment;
  onCommentDeleted: (newTotal: number) => void;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function CommentItem({ postId, comment, onCommentDeleted }: CommentItemProps) {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = user && String(user._id) === String(comment.userId);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteComment(postId, comment.id);
      toast.success("Comment deleted successfully.");
      onCommentDeleted(res.totalComments);
    } catch (err) {
      const errMsg = getPostErrorMessage(err, "Failed to delete comment.");
      toast.error(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedDate = new Date(comment.createdAt).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="flex gap-3 items-start group">
      <Link href={`/users/${comment.userId}`} className="flex-shrink-0">
        <Avatar className="h-8 w-8 border border-orange-50">
          <AvatarFallback className="bg-orange-50 font-semibold text-orange-700 text-xs">
            {getInitials(comment.username || "User")}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0 bg-gray-50 rounded-lg p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/users/${comment.userId}`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline truncate"
            >
              {comment.username}
            </Link>
            <span className="text-[10px] text-gray-400">
              {formattedDate}
            </span>
          </div>

          {isOwner && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-gray-400 hover:text-red-600 rounded-full h-6 w-6 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Delete comment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <p className="text-gray-700 text-xs whitespace-pre-wrap break-words mt-1 leading-normal">
          {comment.text}
        </p>
      </div>
    </div>
  );
}
