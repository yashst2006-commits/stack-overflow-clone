import { useState } from "react";
import { useRouter } from "next/router";

import LoginRequiredModal from "@/components/auth/LoginRequiredModal";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/AuthContext";

interface TopQuestionsHeaderProps {
  questionCount?: number | string;
}

interface FilterTab {
  label: string;
  value: string;
  badge?: number;
}

const filterTabs: FilterTab[] = [
  { label: "Newest", value: "newest" },
  { label: "Active", value: "active" },
  { label: "Bountied", value: "bountied", badge: 25 },
  { label: "Unanswered", value: "unanswered" },
  { label: "More \u25BE", value: "more" },
];

export default function TopQuestionsHeader({
  questionCount = "24,216,732",
}: TopQuestionsHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("newest");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const isLoggedIn = Boolean(user);
  const displayCount =
    typeof questionCount === "number"
      ? questionCount.toLocaleString()
      : questionCount;

  const requireLogin = () => {
    setIsLoginModalOpen(true);
  };

  const handleAskQuestion = () => {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }

    router.push("/questions/ask");
  };

  const handleFilterClick = (filter: FilterTab) => {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }

    setActiveFilter(filter.value);
  };

  return (
    <>
      <section className="mb-4 border-b border-gray-200 bg-white pb-4">
        <div className="mb-7 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            Top Questions
          </h1>
          <button
            type="button"
            onClick={handleAskQuestion}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ask Question
          </button>
        </div>

        <div className="flex flex-col gap-3 text-sm text-gray-600 lg:flex-row lg:items-center">
          <span className="whitespace-nowrap">{displayCount} questions</span>

          <div className="flex flex-wrap items-center gap-1 lg:ml-6">
            {filterTabs.map((filter) => {
              const isActive = filter.value === activeFilter;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => handleFilterClick(filter)}
                  className={`flex items-center rounded px-3 py-2 text-sm ${
                    isActive
                      ? "bg-gray-200 text-gray-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {filter.label}
                  {filter.badge ? (
                    <Badge
                      variant="secondary"
                      className="ml-2 bg-gray-100 px-1.5 py-0 text-xs text-gray-700"
                    >
                      {filter.badge}
                    </Badge>
                  ) : null}
                </button>
              );
            })}
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

