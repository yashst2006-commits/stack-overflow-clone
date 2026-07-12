import { useEffect, useState } from "react";

import QuestionList from "@/components/questions/QuestionList";
import QuestionsHeader from "@/components/questions/QuestionsHeader";
import Mainlayout from "@/layout/Mainlayout";
import { useAuth } from "@/lib/AuthContext";
import { getAllQuestions, type Question } from "@/services/questions";
import { useQuestionFilter } from "@/hooks/useQuestionFilter";

export default function QuestionsPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const data = await getAllQuestions();
        setQuestions(data);
      } catch (error) {
        console.log(error);
        setQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  const { activeFilter, setActiveFilter, visibleQuestions, displayCount, emptyMessage } =
    useQuestionFilter({
      questions,
      userId: user?._id,
    });

  return (
    <Mainlayout>
      <div className="min-w-0 p-4 lg:p-6">
        <QuestionsHeader
          title="Questions"
          questionCount={displayCount}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {isLoading ? (
          <div className="mt-4 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
          </div>
        ) : (
          <QuestionList
            questions={visibleQuestions}
            emptyMessage={emptyMessage}
          />
        )}
      </div>
    </Mainlayout>
  );
}
