import QuestionCard from "@/components/questions/QuestionCard";
import QuestionEmptyState from "@/components/questions/QuestionEmptyState";
import type { Question } from "@/services/questions";

interface QuestionListProps {
  questions: Question[];
}

export default function QuestionList({ questions }: QuestionListProps) {
  if (questions.length === 0) {
    return <QuestionEmptyState />;
  }

  return (
    <div className="space-y-0">
      {questions.map((question) => (
        <QuestionCard key={question._id} question={question} />
      ))}
    </div>
  );
}
