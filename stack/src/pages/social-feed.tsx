import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Head from "next/head";
import { MessageSquare, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "react-toastify";

import Mainlayout from "@/layout/Mainlayout";
import { useAuth } from "@/lib/AuthContext";
import CreatePost from "@/components/CreatePost";
import PostCard from "@/components/PostCard";
import { getFeed, getPostErrorMessage, type Post } from "@/services/postService";

export default function SocialFeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Set mounted state
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Fetch Feed
  const fetchFeed = useCallback(async (showRefreshingState = false) => {
    if (showRefreshingState) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await getFeed();
      setPosts(data);
    } catch (err) {
      console.error("[social-feed] Error loading posts", err);
      setError(getPostErrorMessage(err, "Failed to load posts feed."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasMounted) {
      fetchFeed();
    }
  }, [hasMounted, fetchFeed]);

  const handleRefresh = () => {
    fetchFeed(true);
  };

  return (
    <>
      <Head>
        <title>Social Feed - Code-Quest</title>
        <meta
          name="description"
          content="Interact with the Code-Quest community by sharing text, images, and videos."
        />
      </Head>

      <Mainlayout>
        <div className="max-w-[700px] mx-auto py-2 px-1">
          {/* Header Area */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-4 mb-6 gap-3">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-orange-500 fill-orange-50" />
                Community Feed
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Explore, share, and connect with developers across the globe.
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition shadow-xs disabled:opacity-50 disabled:pointer-events-none"
              title="Refresh feed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-orange-500" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>

          {/* Main Feed Content */}
          <div className="space-y-6">
            {/* Create Post Component (Protected) */}
            {hasMounted && (
              user ? (
                <CreatePost onPostCreated={() => fetchFeed(false)} />
              ) : (
                <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-4 text-center mb-6">
                  <p className="text-sm text-blue-800 font-medium">
                    You are viewing the public feed.
                  </p>
                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Log in to create posts, share images/videos, and interact with the community.
                  </p>
                  <Link
                    href="/auth"
                    className="inline-flex items-center justify-center text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition shadow-xs"
                  >
                    Log In to Post
                  </Link>
                </div>
              )
            )}

            {/* Feed State Renderers */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"></div>
                <span className="text-sm text-gray-500">Loading community feed...</span>
              </div>
            ) : error ? (
              <div className="border border-red-200 bg-red-50 rounded-lg p-5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-red-800 text-sm">
                    Feed Loading Error
                  </h3>
                  <p className="text-red-700 text-xs mt-1 mb-3">{error}</p>
                  <button
                    onClick={() => fetchFeed(false)}
                    className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded transition"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : posts.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center flex flex-col items-center justify-center bg-gray-50/50">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">No posts yet</h3>
                <p className="text-gray-500 text-xs mt-1 mb-4 max-w-[280px] mx-auto">
                  Be the first one to share your thoughts, projects, or questions with the community.
                </p>
                {user && (
                  <button
                    onClick={() => {
                      // Set focus or alert user
                      toast.info("Scroll up to write your post!");
                    }}
                    className="text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md transition shadow-xs"
                  >
                    Write a Post
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onPostDeleted={() => fetchFeed(false)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Mainlayout>
    </>
  );
}
