import axiosInstance from "@/lib/axiosinstance";

export interface Subscription {
  plan: string;
  active: boolean;
  startDate: string;
  endDate: string | null;
}

export interface SubscriptionPlan {
  plan: string;
  price: string;
  limit: string;
  description: string;
}

export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  const response = await axiosInstance.get<{ success: boolean; data: SubscriptionPlan[] }>("/subscription/plans");
  return response.data.data;
};

export const getCurrentSubscription = async (): Promise<Subscription> => {
  const response = await axiosInstance.get<{ success: boolean; data: Subscription }>("/subscription/current");
  return response.data.data;
};

export const createPaymentOrder = async (plan: string): Promise<any> => {
  const response = await axiosInstance.post("/api/payment/create-order", { plan });
  return response.data;
};

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  selectedPlan: string;
}

export const verifyPayment = async (input: VerifyPaymentInput): Promise<any> => {
  const response = await axiosInstance.post("/api/payment/verify", input);
  return response.data;
};


