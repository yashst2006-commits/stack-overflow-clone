import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusMsg = { type: "success" | "error" | null; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const Logo = () => (
  <Link href="/" className="flex items-center justify-center mb-4">
    <div className="w-6 h-6 lg:w-8 lg:h-8 bg-orange-500 rounded mr-2 flex items-center justify-center">
      <div className="w-4 h-4 lg:w-6 lg:h-6 bg-white rounded-sm flex items-center justify-center">
        <div className="w-3 h-3 lg:w-4 lg:h-4 bg-orange-500 rounded-sm" />
      </div>
    </div>
    <span className="text-lg lg:text-xl font-bold text-gray-800">
      stack<span className="font-normal">overflow</span>
    </span>
  </Link>
);

const StatusBanner = ({ status }: { status: StatusMsg }) => {
  if (!status.type) return null;
  const isSuccess = status.type === "success";
  return (
    <div
      className={`p-3 rounded text-sm font-medium ${
        isSuccess
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-red-50 text-red-700 border border-red-200"
      }`}
    >
      {status.message}
    </div>
  );
};

// ── Client-side password validation for user-created passwords ─────────────────
// Policy: 8–20 chars, ≥1 uppercase, ≥1 lowercase. Numbers/symbols allowed.
const validateUserPassword = (password: string): string | null => {
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (password.length > 20) return "Password must be no longer than 20 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  return null;
};

// ── Main component ─────────────────────────────────────────────────────────────

const ForgotPassword = () => {
  const router = useRouter();

  // Step 1 state
  const [step, setStep] = useState<"verify" | "reset" | "done">("verify");
  const [identifier, setIdentifier] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<StatusMsg>({ type: null, message: "" });
  const [userId, setUserId] = useState<string>("");

  // Step 2 state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState<StatusMsg>({ type: null, message: "" });
  const [isGenerated, setIsGenerated] = useState(false);
  const [isBlockedToday, setIsBlockedToday] = useState(false);

  // Success countdown
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (step !== "done") return;
    if (countdown === 0) {
      router.push("/auth");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown, router]);

  // ── Step 1: Verify ──────────────────────────────────────────────────────────

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyStatus({ type: null, message: "" });

    if (!identifier.trim()) {
      setVerifyStatus({ type: "error", message: "Please enter your email address or phone number." });
      return;
    }

    setVerifyLoading(true);
    try {
      const response = await axiosInstance.post("/forgot-password", {
        identifier: identifier.trim(),
      });

      if (response.data?.success) {
        setUserId(response.data.userId);
        setStep("reset");
      } else {
        setVerifyStatus({ type: "error", message: "User not found." });
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "User not found.";
      setVerifyStatus({ type: "error", message: msg });
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Step 2: Generate password ───────────────────────────────────────────────

  const handleGenerate = async () => {
    setResetStatus({ type: null, message: "" });
    setGenerateLoading(true);
    try {
      const response = await axiosInstance.get("/forgot-password/generate");
      const pwd = response.data?.generatedPassword || "";
      setNewPassword(pwd);
      setConfirmPassword(pwd);
      setIsGenerated(true);
    } catch (error: any) {
      setResetStatus({ type: "error", message: "Failed to generate password. Please try again." });
    } finally {
      setGenerateLoading(false);
    }
  };

  // ── Step 2: Reset password ──────────────────────────────────────────────────

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus({ type: null, message: "" });

    // Client-side checks (backend also validates — double safety)
    if (!newPassword || !confirmPassword) {
      setResetStatus({ type: "error", message: "Both password fields are required." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    // Only run strength validation for manually-entered passwords;
    // generated passwords already conform to the letter-only policy.
    if (!isGenerated) {
      const err = validateUserPassword(newPassword);
      if (err) {
        setResetStatus({ type: "error", message: err });
        return;
      }
    }

    setResetLoading(true);
    try {
      const response = await axiosInstance.post("/forgot-password/reset", {
        userId,
        newPassword,
      });

      if (response.data?.success) {
        setStep("done");
        setCountdown(3);
      } else {
        setResetStatus({ type: "error", message: response.data?.message || "Failed to update password." });
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        setIsBlockedToday(true);
      }
      const msg = error.response?.data?.message || "Failed to update password. Please try again.";
      setResetStatus({ type: "error", message: msg });
    } finally {
      setResetLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 lg:mb-8">
          <Logo />
        </div>

        {/* ── STEP 1: Verify ── */}
        {step === "verify" && (
          <form onSubmit={handleVerify}>
            <Card>
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-xl lg:text-2xl">Forgot Password</CardTitle>
                <CardDescription>
                  Enter your registered email address or phone number.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-sm">
                    Email Address or Phone Number
                  </Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="Email Address or Phone Number"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={verifyLoading}
                  />
                </div>

                <StatusBanner status={verifyStatus} />

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white"
                  disabled={verifyLoading}
                >
                  {verifyLoading ? "Verifying..." : "Search User"}
                </Button>

                <div className="text-center text-sm pt-2">
                  <Link href="/auth" className="text-blue-600 hover:underline">
                    Back to Login
                  </Link>
                </div>
              </CardContent>
            </Card>
          </form>
        )}

        {/* ── STEP 2: Reset Password ── */}
        {step === "reset" && (
          <form onSubmit={handleReset}>
            <Card>
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-xl lg:text-2xl">Reset Password</CardTitle>
                <CardDescription>
                  Choose a new password or generate one automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm">
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="text"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setIsGenerated(false);
                    }}
                    disabled={resetLoading || generateLoading || isBlockedToday}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="text"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setIsGenerated(false);
                    }}
                    disabled={resetLoading || generateLoading || isBlockedToday}
                  />
                </div>

                {resetStatus.type && (
                  <div className="space-y-2">
                    <StatusBanner status={resetStatus} />
                    {isBlockedToday && (
                      <p className="text-sm text-center text-gray-500 font-semibold my-2">
                        Try Again Tomorrow
                      </p>
                    )}
                  </div>
                )}

                {/* Generate Password */}
                <Button
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white"
                  onClick={handleGenerate}
                  disabled={resetLoading || generateLoading || isBlockedToday}
                >
                  {generateLoading ? "Generating..." : "Generate Password"}
                </Button>

                {isGenerated && !isBlockedToday && (
                  <p className="text-xs text-blue-600 text-center -mt-2">
                    A password has been generated and filled in above. You may edit it before saving.
                  </p>
                )}

                {/* Update Password */}
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white"
                  disabled={resetLoading || generateLoading || isBlockedToday}
                >
                  {resetLoading ? "Updating..." : "Update Password"}
                </Button>

                {/* Cancel or Back to Login option */}
                {isBlockedToday ? (
                  <Button
                    type="button"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white"
                    onClick={() => router.push("/auth")}
                  >
                    Back to Login
                  </Button>
                ) : (
                  <div className="text-center text-sm pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("verify");
                        setNewPassword("");
                        setConfirmPassword("");
                        setResetStatus({ type: null, message: "" });
                        setIsGenerated(false);
                        setIsBlockedToday(false);
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        )}

        {/* ── STEP 3: Success ── */}
        {step === "done" && (
          <Card>
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-xl lg:text-2xl text-green-700">
                Password Updated!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded text-sm font-medium bg-green-50 text-green-700 border border-green-200 text-center">
                Password updated successfully.
              </div>
              <p className="text-center text-sm text-gray-500">
                Redirecting to Login in{" "}
                <span className="font-semibold text-gray-700">{countdown}</span>s…
              </p>
              <Button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white"
                onClick={() => router.push("/auth")}
              >
                Go to Login Now
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
