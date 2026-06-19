import { useEffect, useState } from "react";

import QuestionList from "@/components/questions/QuestionList";
import QuestionsHeader from "@/components/questions/QuestionsHeader";
import Mainlayout from "@/layout/Mainlayout";
import { getAllQuestions, type Question } from "@/services/questions";

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeFilter, setActiveFilter] = useState("newest");
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

  const visibleQuestions = [...questions]
    .filter((question) => {
      if (activeFilter !== "unanswered") {
        return true;
      }

      const answerCount = question.noofanswer ?? question.answer?.length ?? 0;
      return answerCount === 0;
    })
    .sort((first, second) => {
      const firstDate =
        activeFilter === "active"
          ? first.updatedAt || first.askedon || first.createdAt
          : first.createdAt || first.askedon || first.updatedAt;
      const secondDate =
        activeFilter === "active"
          ? second.updatedAt || second.askedon || second.createdAt
          : second.createdAt || second.askedon || second.updatedAt;

      return (
        new Date(secondDate || 0).getTime() -
        new Date(firstDate || 0).getTime()
      );
    });

  return (
    <Mainlayout>
      <div className="min-w-0">
        <QuestionsHeader
          questionCount={questions.length}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {isLoading ? (
          <div className="mt-4 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
          </div>
        ) : (
          <QuestionList questions={visibleQuestions} />
        )}
      </div>
    </Mainlayout>
  );
}
