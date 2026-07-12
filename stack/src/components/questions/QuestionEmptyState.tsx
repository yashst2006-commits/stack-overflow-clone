interface QuestionEmptyStateProps {
  message?: string;
}

export default function QuestionEmptyState({
  message = "No questions found.",
}: QuestionEmptyStateProps) {
  return (
    <div className="mt-6 text-center text-gray-500">{message}</div>
  );
}
