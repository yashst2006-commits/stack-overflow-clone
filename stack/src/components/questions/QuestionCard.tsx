import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Question } from "@/services/questions";

interface QuestionCardProps {
  question: Question;
}

const getRelativeTime = (date?: string) => {
  if (!date) {
    return "just now";
  }

  const timestamp = new Date(date).getTime();
  const diffInSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (diffInSeconds < 60) return "just now";

  const units = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
  ];

  const unit = units.find((item) => diffInSeconds >= item.seconds);

  if (!unit) return "just now";

  const value = Math.floor(diffInSeconds / unit.seconds);
  return `${value} ${unit.label}${value === 1 ? "" : "s"} ago`;
};

export default function QuestionCard({ question }: QuestionCardProps) {
  const title = question.questiontitle || "Untitled question";
  const description = question.questionbody || "";
  const tags = question.questiontags || [];
  const answers = question.noofanswer ?? question.answer?.length ?? 0;
  const votes =
    (question.upvote?.length ?? 0) - (question.downvote?.length ?? 0);
  const views = question.views ?? 0;
  const author = question.userposted || "Unknown user";
  const askedTime = getRelativeTime(question.createdAt || question.askedon);

  return (
    <article className="border-b border-gray-200 py-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex gap-4 text-sm text-gray-600 sm:w-24 sm:flex-col sm:items-end sm:gap-2">
          <div>{votes} {votes === 1 ? "vote" : "votes"}</div>
          <div
            className={
              answers > 0
                ? "rounded border border-green-600 px-2 py-1 text-green-700"
                : ""
            }
          >
            {answers} {answers === 1 ? "answer" : "answers"}
          </div>
          <div>{views} {views === 1 ? "view" : "views"}</div>
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`/questions/${question._id}`}
            className="mb-2 block text-base font-medium text-blue-600 hover:text-blue-800 hover:underline lg:text-lg"
          >
            {title}
          </Link>

          <p className="mb-3 line-clamp-2 text-sm leading-6 text-gray-700">
            {description}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="bg-blue-100 text-xs text-blue-800 hover:bg-blue-200"
                >
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex items-center justify-end text-xs text-gray-600">
              <Avatar className="mr-1 h-5 w-5">
                <AvatarFallback className="text-xs">
                  {author.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="mr-1 text-blue-600">{author}</span>
              <span>asked {askedTime}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
