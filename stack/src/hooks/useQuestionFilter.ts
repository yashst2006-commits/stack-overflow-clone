import { useMemo, useState } from "react";

import type { Question } from "@/services/questions";

export type FilterValue =
  | "newest"
  | "bountied"
  | "unanswered"
  | "most-votes"
  | "most-answers"
  | "oldest"
  | "recently-updated"
  | "my-questions"
  | "no-tags";

interface UseQuestionFilterOptions {
  questions: Question[];
  /** The _id of the currently logged-in user (undefined when logged out). */
  userId?: string;
}

export interface UseQuestionFilterResult {
  activeFilter: FilterValue;
  setActiveFilter: (filter: FilterValue) => void;
  visibleQuestions: Question[];
  /** Count to display in the header — reflects the active filter. */
  displayCount: number;
  /** True when the bountied informational message should be shown. */
  isBountied: boolean;
  /** Message to show when the filtered list is empty. */
  emptyMessage: string;
}

const getTimestamp = (date?: string) =>
  date ? new Date(date).getTime() : 0;

export function useQuestionFilter({
  questions,
  userId,
}: UseQuestionFilterOptions): UseQuestionFilterResult {
  const [activeFilter, setActiveFilter] = useState<FilterValue>("newest");

  const isBountied = activeFilter === "bountied";

  const visibleQuestions = useMemo(() => {
    if (isBountied) return [];

    let result = [...questions];

    // ── Filters ────────────────────────────────────────────────
    if (activeFilter === "unanswered") {
      result = result.filter(
        (q) => (q.noofanswer ?? q.answer?.length ?? 0) === 0
      );
    } else if (activeFilter === "my-questions") {
      result = result.filter((q) => userId && q.userid === userId);
    } else if (activeFilter === "no-tags") {
      result = result.filter(
        (q) => !q.questiontags || q.questiontags.length === 0
      );
    }

    // ── Sorts ──────────────────────────────────────────────────
    if (activeFilter === "newest") {
      result.sort(
        (a, b) =>
          getTimestamp(b.createdAt || b.askedon) -
          getTimestamp(a.createdAt || a.askedon)
      );
    } else if (activeFilter === "oldest") {
      result.sort(
        (a, b) =>
          getTimestamp(a.createdAt || a.askedon) -
          getTimestamp(b.createdAt || b.askedon)
      );
    } else if (activeFilter === "most-votes") {
      result.sort(
        (a, b) =>
          (b.upvote?.length ?? 0) -
          (b.downvote?.length ?? 0) -
          ((a.upvote?.length ?? 0) - (a.downvote?.length ?? 0))
      );
    } else if (activeFilter === "most-answers") {
      result.sort(
        (a, b) =>
          (b.noofanswer ?? b.answer?.length ?? 0) -
          (a.noofanswer ?? a.answer?.length ?? 0)
      );
    } else if (activeFilter === "recently-updated") {
      result.sort(
        (a, b) =>
          getTimestamp(b.updatedAt || b.createdAt || b.askedon) -
          getTimestamp(a.updatedAt || a.createdAt || a.askedon)
      );
    } else {
      // unanswered / my-questions / no-tags: secondary sort by newest
      result.sort(
        (a, b) =>
          getTimestamp(b.createdAt || b.askedon) -
          getTimestamp(a.createdAt || a.askedon)
      );
    }

    return result;
  }, [questions, activeFilter, userId, isBountied]);

  const emptyMessage = useMemo<string>(() => {
    if (isBountied) return "No questions currently have an active bounty.";
    if (activeFilter === "unanswered") return "No unanswered questions found.";
    if (activeFilter === "my-questions")
      return "You haven't asked any questions yet.";
    if (activeFilter === "no-tags") return "No questions without tags found.";
    return "No questions found.";
  }, [activeFilter, isBountied]);

  const displayCount = isBountied ? 0 : visibleQuestions.length;

  return {
    activeFilter,
    setActiveFilter: (f) => setActiveFilter(f),
    visibleQuestions,
    displayCount,
    isBountied,
    emptyMessage,
  };
}
