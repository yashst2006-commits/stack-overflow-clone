import React, { useState } from "react";
import { toast } from "react-toastify";
import { Share2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { sharePost, getPostErrorMessage, type Post } from "@/services/postService";

interface ShareDialogProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onShareSuccess: (newShareCount: number) => void;
}

export default function ShareDialog({
  post,
  isOpen,
  onClose,
  onShareSuccess,
}: ShareDialogProps) {
  const [caption, setCaption] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const handleShare = async (confirmFlag = false) => {
    setIsSharing(true);
    try {
      const res = await sharePost(post.id, caption.trim(), confirmFlag);

      if (res.requiresConfirmation) {
        setNeedsConfirm(true);
        setIsSharing(false);
        return;
      }

      if (res.success && res.totalShares !== undefined) {
        toast.success("Post shared to public feed!");
        onShareSuccess(res.totalShares);
        setCaption("");
        setNeedsConfirm(false);
        onClose();
      }
    } catch (err) {
      const errMsg = getPostErrorMessage(err, "Failed to share post.");
      toast.error(errMsg);
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = () => {
    if (isSharing) return;
    setCaption("");
    setNeedsConfirm(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white max-w-md border border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-bold flex items-center gap-2">
            <Share2 className="w-5 h-5 text-orange-500" />
            <span>Share Post</span>
          </DialogTitle>
        </DialogHeader>

        {needsConfirm ? (
          <div className="space-y-4 py-2 text-left">
            <div className="flex gap-3 items-start p-3 rounded-lg border border-yellow-100 bg-yellow-50/50 text-yellow-800">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">Duplicate Share Warning</p>
                <p className="text-yellow-700">
                  You have already shared this post. Do you want to share it again to your feed?
                </p>
              </div>
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNeedsConfirm(false)}
                disabled={isSharing}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => handleShare(true)}
                disabled={isSharing}
                className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-4"
              >
                {isSharing ? "Sharing..." : "Yes, Share Again"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-left">
            {/* Optional Caption Textarea */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-550">
                Add optional caption
              </label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Why are you sharing this post? Say something..."
                className="text-xs min-h-[70px] focus-visible:ring-orange-200 border-gray-200 placeholder-gray-400 text-gray-800"
                disabled={isSharing}
              />
            </div>

            {/* Preview of original post */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3.5 space-y-1 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-800">
                  {post.username}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-3 leading-normal whitespace-pre-wrap mt-1">
                {post.caption || "[Media attachment]"}
              </p>
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSharing}
                className="text-xs text-gray-600 border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => handleShare(false)}
                disabled={isSharing}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-4 shadow-sm"
              >
                {isSharing ? "Sharing..." : "Share Now"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
