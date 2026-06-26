import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import { Image as ImageIcon, Video as VideoIcon, X, Send, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createPost,
  getPostErrorMessage,
  getPostingStatus,
  type PostingStatus,
} from "@/services/postService";

interface CreatePostProps {
  onPostCreated: () => void;
}

export default function CreatePost({ onPostCreated }: CreatePostProps) {
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Posting status state
  const [status, setStatus] = useState<PostingStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await getPostingStatus();
      setStatus(res);
    } catch (err) {
      console.error("[CreatePost] Error fetching posting status:", err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    const handlePostChange = () => {
      fetchStatus();
    };
    window.addEventListener("post-changed", handlePostChange);
    return () => {
      window.removeEventListener("post-changed", handlePostChange);
    };
  }, []);

  const isFormRestricted =
    status !== null &&
    (status.friendCount === 0 ||
      (!status.unlimited && status.remainingPosts === 0));

  const isPostDisabled = isSubmitting || isFormRestricted;

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // File Validation
  const validateImageFile = (file: File): string | null => {
    const allowedImageExts = /\.(jpe?g|jpg|png|webp)$/i;
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedMimeTypes.includes(file.type) && !allowedImageExts.test(file.name)) {
      return "Invalid image format. Supported formats: jpg, jpeg, png, webp";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "Image file size exceeds 5 MB limit";
    }
    return null;
  };

  const validateVideoFile = (file: File): string | null => {
    const allowedVideoExts = /\.(mp4|mov|webm)$/i;
    const allowedMimeTypes = ["video/mp4", "video/quicktime", "video/webm"];

    if (!allowedMimeTypes.includes(file.type) && !allowedVideoExts.test(file.name)) {
      return "Invalid video format. Supported formats: mp4, mov, webm";
    }
    if (file.size > 50 * 1024 * 1024) {
      return "Video file size exceeds 50 MB limit";
    }
    return null;
  };

  // File Handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    // Clear video file if selected (a post can have both, but let's let them select both or either. Requirements: "create a post with optional images and videos", so both is allowed!)
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateVideoFile(file);
    if (error) {
      toast.error(error);
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  // Remove Attachment Handlers
  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
      setVideoPreview(null);
    }
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCaption = caption.trim();
    if (!trimmedCaption && !imageFile && !videoFile) {
      toast.error("Please add a caption, an image, or a video to share.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      if (trimmedCaption) {
        formData.append("caption", trimmedCaption);
      }
      if (imageFile) {
        formData.append("image", imageFile);
      }
      if (videoFile) {
        formData.append("video", videoFile);
      }

      await createPost(formData);
      toast.success("Post shared successfully!");

      // Reset Form State
      setCaption("");
      removeImage();
      removeVideo();

      // Refresh limits status
      await fetchStatus();

      // Trigger feed reload
      onPostCreated();
    } catch (err) {
      const errMsg = getPostErrorMessage(err, "Failed to create post. Try again.");
      toast.error(errMsg);
      // Refresh status on failure as well
      fetchStatus();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border border-gray-200 shadow-sm bg-white mb-6">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-gray-800">
            Share something with the community
          </CardTitle>
          {status && (
            <p className="text-xs text-gray-500 mt-1">
              Friends: <span className="font-semibold text-gray-700">{status.friendCount}</span>
              {" • "}
              {status.unlimited ? (
                <>
                  Posting Limit: <span className="font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-[10px]">Unlimited</span>
                </>
              ) : (
                <>
                  Today's Posts: <span className="font-semibold text-gray-700">{status.postsToday} / {status.dailyLimit}</span>
                  {" • "}
                  Remaining: <span className={`font-semibold ${status.remainingPosts === 0 ? "text-red-500" : "text-gray-700"}`}>{status.remainingPosts}</span>
                </>
              )}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Zero Friends Callout Banner */}
          {status && status.friendCount === 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 mb-1 rounded-lg border border-red-100 bg-red-50/50 text-red-800 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 text-red-650 flex-shrink-0" />
                <span className="font-semibold text-red-750">
                  You need at least one accepted friend before posting publicly.
                </span>
              </div>
              <Link href="/friends" passHref legacyBehavior>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="text-xs font-semibold px-3 py-1 cursor-pointer bg-red-600 hover:bg-red-700 text-white rounded transition shadow-xs"
                >
                  Find Friends
                </Button>
              </Link>
            </div>
          )}

          {/* Daily Limit Reached Callout Banner */}
          {status && !status.unlimited && status.remainingPosts === 0 && status.friendCount > 0 && (
            <div className="flex items-start gap-2.5 p-3.5 mb-1 rounded-lg border border-amber-100 bg-amber-50/50 text-amber-850 text-xs">
              <AlertCircle className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-900">
                  You have reached today's posting limit.
                </p>
                <p className="text-amber-700">Come back tomorrow.</p>
              </div>
            </div>
          )}

          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What is on your mind? Share a thought, an image, or a video..."
            className="min-h-[80px] text-gray-800 placeholder-gray-400 focus-visible:ring-orange-200 border-gray-200"
            disabled={isSubmitting || isFormRestricted}
          />

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageChange}
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
          />
          <input
            type="file"
            ref={videoInputRef}
            onChange={handleVideoChange}
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
          />

          {/* Media Previews */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {imagePreview && (
              <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-1 group">
                <img
                  src={imagePreview}
                  alt="Selected Image Preview"
                  className="rounded-md max-h-[160px] w-full object-contain mx-auto"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-gray-900/80 hover:bg-red-600 text-white rounded-full p-1 transition shadow-sm"
                  title="Remove image"
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {videoPreview && (
              <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-1 group">
                <video
                  src={videoPreview}
                  controls
                  className="rounded-md max-h-[160px] w-full object-contain mx-auto"
                />
                <button
                  type="button"
                  onClick={removeVideo}
                  className="absolute top-2 right-2 bg-gray-900/80 hover:bg-red-600 text-white rounded-full p-1 transition shadow-sm"
                  title="Remove video"
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-gray-600 border-gray-200 hover:bg-gray-50 flex items-center gap-1.5"
                onClick={() => imageInputRef.current?.click()}
                disabled={isSubmitting || isFormRestricted}
              >
                <ImageIcon className="w-4 h-4 text-green-600" />
                <span>Image</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-gray-600 border-gray-200 hover:bg-gray-50 flex items-center gap-1.5"
                onClick={() => videoInputRef.current?.click()}
                disabled={isSubmitting || isFormRestricted}
              >
                <VideoIcon className="w-4 h-4 text-blue-600" />
                <span>Video</span>
              </Button>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={isPostDisabled}
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium flex items-center gap-1.5 px-4 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Posting..." : "Post"}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
