import axios from "axios";
import axiosInstance from "@/lib/axiosinstance";

export interface Comment {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  caption: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  likes: string[];
  comments: Comment[];
  
  // Sharing fields
  isShared: boolean;
  originalPostId: string | null;
  originalAuthorId: string | null;
  originalAuthor: string | null;
  shareCaption: string | null;
  shareCount: number;
  
  createdAt: string;
}

interface FeedResponse {
  success: boolean;
  data: Post[];
}

interface PostResponse {
  success: boolean;
  data: Post;
}

interface LikeActionResponse {
  success: boolean;
  liked: boolean;
  totalLikes: number;
}

interface LikesInfoResponse {
  totalLikes: number;
  likedByCurrentUser: boolean;
}

interface AddCommentResponse {
  success: boolean;
  comment: Comment;
  totalComments: number;
}

interface GetCommentsResponse {
  totalComments: number;
  comments: Comment[];
}

interface DeleteCommentResponse {
  success: boolean;
  totalComments: number;
}

interface ShareActionResponse {
  success: boolean;
  requiresConfirmation?: boolean;
  sharedPost?: Post;
  totalShares?: number;
  message?: string;
}

interface ShareInfoResponse {
  totalShares: number;
  sharedBy: {
    userId: string;
    username: string;
    sharedAt: string;
  }[];
}

export interface PostingStatus {
  friendCount: number;
  dailyLimit: number | null;
  postsToday: number;
  remainingPosts: number | null;
  unlimited: boolean;
}

export const getFeed = async (): Promise<Post[]> => {
  const response = await axiosInstance.get<FeedResponse>("/posts/feed");
  return response.data.data || [];
};

export const getPostById = async (id: string): Promise<Post> => {
  const response = await axiosInstance.get<PostResponse>(`/posts/${id}`);
  return response.data.data;
};

export const createPost = async (formData: FormData): Promise<Post> => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await axiosInstance.post<PostResponse>("/posts/create", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      "x-timezone": timezone,
    },
  });
  return response.data.data;
};

export const deletePost = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/posts/${id}`);
};

export const likePost = async (postId: string): Promise<LikeActionResponse> => {
  const response = await axiosInstance.post<LikeActionResponse>(`/posts/${postId}/like`);
  return response.data;
};

export const unlikePost = async (postId: string): Promise<LikeActionResponse> => {
  const response = await axiosInstance.delete<LikeActionResponse>(`/posts/${postId}/like`);
  return response.data;
};

export const getLikesInfo = async (postId: string): Promise<LikesInfoResponse> => {
  const response = await axiosInstance.get<LikesInfoResponse>(`/posts/${postId}/likes`);
  return response.data;
};

export const addComment = async (postId: string, text: string): Promise<AddCommentResponse> => {
  const response = await axiosInstance.post<AddCommentResponse>(`/posts/${postId}/comments`, { text });
  return response.data;
};

export const getComments = async (postId: string): Promise<GetCommentsResponse> => {
  const response = await axiosInstance.get<GetCommentsResponse>(`/posts/${postId}/comments`);
  return response.data;
};

export const deleteComment = async (postId: string, commentId: string): Promise<DeleteCommentResponse> => {
  const response = await axiosInstance.delete<DeleteCommentResponse>(`/posts/${postId}/comments/${commentId}`);
  return response.data;
};

export const sharePost = async (
  postId: string,
  shareCaption: string,
  confirm = false
): Promise<ShareActionResponse> => {
  const response = await axiosInstance.post<ShareActionResponse>(`/posts/${postId}/share`, {
    shareCaption,
    confirm,
  });
  return response.data;
};

export const getSharedPosts = async (): Promise<Post[]> => {
  const response = await axiosInstance.get<{ success: boolean; data: Post[] }>("/posts/shared");
  return response.data.data || [];
};

export const getShareInfo = async (postId: string): Promise<ShareInfoResponse> => {
  const response = await axiosInstance.get<ShareInfoResponse>(`/posts/${postId}/share-info`);
  return response.data;
};

export const getPostingStatus = async (): Promise<PostingStatus> => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await axiosInstance.get<PostingStatus>("/posts/posting-status", {
    params: { timezone },
  });
  return response.data;
};

export const getPostErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;
    if (responseMessage) {
      return responseMessage;
    }
    if (!error.response) {
      return "Cannot connect to the backend. Confirm that the server is running on port 5000.";
    }
    if (error.response.status === 404) {
      return `API route ${error.config?.url || ""} was not found. Restart the backend server.`;
    }
  }
  return fallbackMessage;
};
