import QuestionCard from "@/components/questions/QuestionCard";
import QuestionEmptyState from "@/components/questions/QuestionEmptyState";
import type { Question } from "@/services/questions";

interface QuestionListProps {
  questions: Question[];
  emptyMessage?: string;
}

export default function QuestionList({
  questions,
  emptyMessage,
}: QuestionListProps) {
  if (questions.length === 0) {
    return <QuestionEmptyState message={emptyMessage} />;
  }

  return (
    <div className="space-y-0">
      {questions.map((question) => (
        <QuestionCard key={question._id} question={question} />
      ))}
    </div>
  );
}
