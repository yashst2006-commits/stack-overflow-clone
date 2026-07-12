import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import LoginRequiredModal from "@/components/auth/LoginRequiredModal";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/AuthContext";
import type { FilterValue } from "@/hooks/useQuestionFilter";

// ── Types ────────────────────────────────────────────────────────────────────

interface QuestionsHeaderProps {
  /** Heading text: "Top Questions" (home) or "Questions" (questions page). */
  title: string;
  /** Reflects the currently filtered question count — not the raw total. */
  questionCount: number;
  activeFilter: FilterValue;
  onFilterChange: (filter: FilterValue) => void;
}

interface Tab {
  label: string;
  value: FilterValue;
  badge?: number;
}

interface MoreOption {
  label: string;
  value: FilterValue;
  requiresLogin?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { label: "Newest", value: "newest" },
  { label: "Bountied", value: "bountied", badge: 0 },
  { label: "Unanswered", value: "unanswered" },
];

const MORE_OPTIONS: MoreOption[] = [
  { label: "Most Votes", value: "most-votes" },
  { label: "Most Answers", value: "most-answers" },
  { label: "Oldest", value: "oldest" },
  { label: "Recently Updated", value: "recently-updated" },
  { label: "My Questions", value: "my-questions", requiresLogin: true },
  { label: "No Tags", value: "no-tags" },
];

const MORE_VALUES = new Set<string>(MORE_OPTIONS.map((o) => o.value));

// ── Component ────────────────────────────────────────────────────────────────

export default function QuestionsHeader({
  title,
  questionCount,
  activeFilter,
  onFilterChange,
}: QuestionsHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isLoggedIn = Boolean(user);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close the More dropdown when clicking outside it
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const questionLabel = questionCount === 1 ? "question" : "questions";
  const isMoreActive = MORE_VALUES.has(activeFilter);

  const handleAskQuestion = () => {
    if (!isLoggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    router.push("/questions/ask");
  };

  const handleTabClick = (value: FilterValue) => {
    if (!isLoggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    onFilterChange(value);
    setMoreOpen(false);
  };

  const handleMoreOption = (option: MoreOption) => {
    if (!isLoggedIn) {
      setIsLoginModalOpen(true);
      setMoreOpen(false);
      return;
    }
    if (option.requiresLogin && !isLoggedIn) return;
    onFilterChange(option.value);
    setMoreOpen(false);
  };

  return (
    <>
      <section className="mb-4 border-b border-gray-200 bg-white pb-4">
        {/* Title row */}
        <div className="mb-7 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            {title}
          </h1>
          <button
            type="button"
            onClick={handleAskQuestion}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ask Question
          </button>
        </div>

        {/* Count + filter tabs row */}
        <div className="flex flex-col gap-3 text-sm text-gray-600 lg:flex-row lg:items-center">
          <span className="whitespace-nowrap">
            {questionCount.toLocaleString()} {questionLabel}
          </span>

          <div className="flex flex-wrap items-center gap-1 lg:ml-6">
            {/* Main tabs: Newest, Bountied, Unanswered */}
            {TABS.map((tab) => {
              const isActive = tab.value === activeFilter;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleTabClick(tab.value)}
                  className={`flex items-center rounded px-3 py-2 text-sm ${
                    isActive
                      ? "bg-gray-200 text-gray-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                  {tab.badge !== undefined ? (
                    <Badge
                      variant="secondary"
                      className="ml-2 bg-gray-100 px-1.5 py-0 text-xs text-gray-700"
                    >
                      {tab.badge}
                    </Badge>
                  ) : null}
                </button>
              );
            })}

            {/* More dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((prev) => !prev)}
                className={`flex items-center rounded px-3 py-2 text-sm ${
                  isMoreActive || moreOpen
                    ? "bg-gray-200 text-gray-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {isMoreActive
                  ? (MORE_OPTIONS.find((o) => o.value === activeFilter)
                      ?.label ?? "More")
                  : "More"}
                <span className="ml-1 text-xs">▾</span>
              </button>

              {moreOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded border border-gray-200 bg-white py-1 shadow-lg">
                  {MORE_OPTIONS.map((option) => {
                    const disabled = option.requiresLogin && !isLoggedIn;
                    const isOptionActive = activeFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          disabled ? undefined : handleMoreOption(option)
                        }
                        disabled={disabled}
                        className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                          disabled
                            ? "cursor-not-allowed text-gray-400"
                            : isOptionActive
                            ? "bg-gray-100 font-medium text-gray-800"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {option.label}
                        {disabled && (
                          <span className="ml-2 text-xs text-gray-400">
                            (login)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <LoginRequiredModal
        open={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
      />
    </>
  );
}
