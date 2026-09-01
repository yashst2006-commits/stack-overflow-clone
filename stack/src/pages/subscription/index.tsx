import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { AlertCircle, Calendar, CreditCard, Sparkles, UserCheck } from "lucide-react";
import Mainlayout from "@/layout/Mainlayout";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "react-toastify";
import {
  getCurrentSubscription,
  getSubscriptionPlans,
  createPaymentOrder,
  verifyPayment,
  type Subscription,
  type SubscriptionPlan,
} from "@/services/subscriptionService";
import { SubscriptionCard } from "@/components/subscription/SubscriptionCard";

const getISTTimeParts = () => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });
  
  // Support window.__mockDate for testing
  const targetDate = (typeof window !== "undefined" && (window as any).__mockDate) 
    ? new Date((window as any).__mockDate) 
    : new Date();

  const parts = formatter.formatToParts(targetDate);
  const hour   = parseInt(parts.find(p => p.type === 'hour')?.value   ?? "0", 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? "0", 10);
  const second = parseInt(parts.find(p => p.type === 'second')?.value ?? "0", 10);
  return { hour, minute, second };
};

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [istTime, setIstTime] = useState<{ hour: number; minute: number; second: number } | null>(null);
  const [isWindowOpen, setIsWindowOpen] = useState<boolean>(false);

  const getCountdownString = () => {
    if (!istTime) return "";
    const min = 59 - istTime.minute;
    const sec = 59 - istTime.second;
    return `${min} minute${min !== 1 ? 's' : ''} and ${sec} second${sec !== 1 ? 's' : ''}`;
  };

  useEffect(() => {
    const updateTime = () => {
      try {
        const parts = getISTTimeParts();
        setIstTime(parts);
        setIsWindowOpen(parts.hour === 10);
      } catch (err) {
        console.error("Error formatting IST time:", err);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Hoist fetchData to component scope so handleSubscribe can call it ──────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedPlans = await getSubscriptionPlans();
      setPlans(fetchedPlans);
      if (user) {
        const fetchedSub = await getCurrentSubscription();
        setCurrentSub(fetchedSub);
      }
    } catch (err) {
      console.error("[subscription-page] Error loading data", err);
      setError("Failed to load subscription details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (planName: string) => {
    if (!user) {
      toast.error("You must be logged in to subscribe");
      return;
    }

    // Immediate time check before API call (Step 8)
    const currentParts = getISTTimeParts();
    if (currentParts.hour !== 10) {
      toast.error("Payments are allowed only between 10:00 AM and 11:00 AM IST.");
      return;
    }

    setSubscribingPlan(planName);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Failed to load Razorpay SDK. Please check your connection.");
        setSubscribingPlan(null);
        return;
      }

      // Call create-order API
      const orderData = await createPaymentOrder(planName);

      if (!orderData.success || !orderData.orderId) {
        throw new Error("Invalid order data received from server");
      }

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Stack Overflow Clone",
        description: "Subscription Payment",
        order_id: orderData.orderId,
        theme: {
          color: "#ef8236", // StackOverflow Brand Orange
        },
        prefill: {
          name: user.name || "",
          email: user.email || "",
          // Only pass contact if a non-empty phone number is available
          ...(user.phone ? { contact: user.phone } : {}),
        },
        handler: async function (response: any) {
          console.log("[Razorpay Payment Success] Details:", {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });

          try {
            setSubscribingPlan(planName);
            const verificationResult = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              selectedPlan: planName,
            });

            if (verificationResult.success) {
              // Show message based on whether invoice email was sent (Phase 5)
              if (verificationResult.emailSent === true) {
                toast.success(
                  verificationResult.message ||
                    "Subscription activated. Invoice sent to your registered email."
                );
              } else if (verificationResult.emailSent === false) {
                toast.warn(
                  verificationResult.message ||
                    "Subscription activated, but we could not send the invoice email."
                );
              } else {
                toast.success("Subscription activated successfully.");
              }
              // Refresh subscription details automatically
              await fetchData();
            } else {
              toast.error("Payment verification failed.");
            }
          } catch (verificationErr: any) {
            console.error("[payment-verification] Error:", verificationErr);
            toast.error(verificationErr.response?.data?.message || "Payment verification failed.");
          } finally {
            setSubscribingPlan(null);
          }
        },
        modal: {
          ondismiss: function () {
            toast.error("Payment cancelled by user");
            setSubscribingPlan(null);
          },
        },
      };

      // ── Debug: log all values passed to Razorpay before opening ────────────
      console.log("[Razorpay] Script loaded:", typeof (window as any).Razorpay);
      console.log("[Razorpay] key:", orderData.key);
      console.log("[Razorpay] order_id:", orderData.orderId);
      console.log("[Razorpay] amount (paise):", orderData.amount);
      console.log("[Razorpay] currency:", orderData.currency);

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        console.error("[Razorpay Payment Failed]:", response.error);
        toast.error(response.error.description || "Payment failed");
        setSubscribingPlan(null);
      });

      rzp.open();
    } catch (err: any) {
      console.error("[payment-initialization] Error:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to initialize payment");
      setSubscribingPlan(null);
    }
  };

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      fetchData();
    }
  }, [hasMounted, fetchData]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <Head>
        <title>Subscriptions - Code-Quest</title>
        <meta
          name="description"
          content="Choose the right subscription plan for Code-Quest to post questions and access premium features."
        />
      </Head>

      <Mainlayout>
        <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="border-b border-gray-200 pb-5 mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-orange-500 fill-orange-50" />
              Subscription Plans
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Upgrade your account to unlock higher question posting limits and premium features.
            </p>
          </div>

          {/* Payment Time Restriction Status Banner (Step 7) */}
          {hasMounted && (
            isWindowOpen ? (
              <div className="mb-6 border border-emerald-200 bg-emerald-50 rounded-xl p-5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <Sparkles className="w-6 h-6 text-emerald-600 flex-shrink-0 animate-pulse" />
                  <div className="flex-1">
                    <h3 className="font-bold text-emerald-900 text-base">Payment Window Open</h3>
                    <p className="text-emerald-700 text-sm mt-1">
                      Payments are available until 11:00 AM IST.
                    </p>
                    {istTime && (
                      <p className="text-emerald-850 text-sm font-semibold mt-2 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        Payment window closes in: <span className="font-mono text-emerald-950">{getCountdownString()}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 border border-amber-200 bg-amber-50/70 rounded-xl p-5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-amber-900 text-base">Payment Window Closed</h3>
                    <p className="text-amber-700 text-sm mt-1">
                      Payments are available only between 10:00 AM and 11:00 AM IST.
                    </p>
                    <p className="text-amber-800/80 text-xs mt-2 italic">
                      All subscription purchases and updates are restricted to this time window.
                    </p>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-6 border border-red-200 bg-red-50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 text-sm">Error Loading Subscription</h3>
                <p className="text-red-700 text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Current Subscription Section */}
          {hasMounted && (
            <div className="mb-10 bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-orange-500" />
                Current Subscription
              </h2>

              {loading ? (
                <div className="flex items-center space-x-3 py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-orange-500"></div>
                  <span className="text-sm text-gray-500">Loading your subscription details...</span>
                </div>
              ) : user ? (
                currentSub ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Plan Name</span>
                      <span className="text-lg font-bold text-blue-600 mt-1">{currentSub.plan} Plan</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Status</span>
                      <span className={`inline-flex items-center gap-1 text-sm font-semibold mt-1.5 ${
                        currentSub.active ? "text-green-600" : "text-gray-500"
                      }`}>
                        <UserCheck className="w-4 h-4" />
                        {currentSub.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Billing Dates
                      </span>
                      <span className="text-sm text-gray-600 mt-1">
                        Started: <strong className="text-gray-900">{formatDate(currentSub.startDate)}</strong>
                      </span>
                      {currentSub.endDate && (
                        <span className="text-xs text-gray-500 mt-0.5">
                          Expires: {formatDate(currentSub.endDate)}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Could not retrieve subscription details.</p>
                )
              ) : (
                <div className="bg-blue-50/40 border border-blue-100 rounded-lg p-5 text-center">
                  <p className="text-sm text-blue-900 font-medium">You are not logged in</p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">
                    Please log in to check your active plan and manage subscriptions.
                  </p>
                  <Link
                    href="/auth"
                    className="inline-flex items-center justify-center text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition shadow-xs"
                  >
                    Log In / Sign Up
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Plans Grid */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Available Plans</h2>
            {loading && plans.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-6 h-[320px] bg-white animate-pulse flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                      <div className="h-10 bg-gray-200 rounded w-1/3 mt-6"></div>
                    </div>
                    <div className="h-10 bg-gray-200 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                {plans.map((plan) => {
                  const isActive = currentSub ? currentSub.plan.toLowerCase() === plan.plan.toLowerCase() && currentSub.active : false;
                  return (
                    <SubscriptionCard
                      key={plan.plan}
                      plan={plan}
                      isActive={isActive}
                      onSubscribe={handleSubscribe}
                      isSubscribing={subscribingPlan === plan.plan}
                      isDisabled={!isWindowOpen}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Mainlayout>
    </>
  );
}
