import axios from "axios";

import axiosInstance from "@/lib/axiosinstance";

export interface FriendUser {
  _id: string;
  name: string;
  username?: string;
  about?: string;
  tags?: string[];
  joinDate?: string;
}

export interface FriendOverview {
  friends: FriendUser[];
  pendingSent: FriendUser[];
  pendingReceived: FriendUser[];
  friendCount: number;
}

interface UsersResponse {
  data: FriendUser[];
}

export const getFriendOverview = async (): Promise<FriendOverview> => {
  const response = await axiosInstance.get<FriendOverview>("/friends/list");
  return response.data;
};

export const getAllUsers = async (): Promise<FriendUser[]> => {
  const response = await axiosInstance.get<UsersResponse>("/user/getalluser");
  return response.data.data || [];
};

export const sendFriendRequest = async (receiverId: string) => {
  const response = await axiosInstance.post("/friends/request", { receiverId });
  return response.data;
};

export const acceptFriendRequest = async (senderId: string) => {
  const response = await axiosInstance.post("/friends/accept", { senderId });
  return response.data;
};

export const rejectFriendRequest = async (senderId: string) => {
  const response = await axiosInstance.post("/friends/reject", { senderId });
  return response.data;
};

export const removeFriend = async (friendId: string) => {
  const response = await axiosInstance.delete(
    `/friends/remove/${encodeURIComponent(friendId)}`
  );
  return response.data;
};

export const getFriendCount = async (): Promise<number> => {
  const response = await axiosInstance.get<{ friendCount: number }>(
    "/friends/count"
  );
  return response.data.friendCount;
};

export const getFriendErrorMessage = (
  error: unknown,
  fallbackMessage: string
) => {
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
