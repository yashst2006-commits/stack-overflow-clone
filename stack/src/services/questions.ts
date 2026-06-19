import axiosInstance from "@/lib/axiosinstance";

export interface Answer {
  _id?: string;
  answerbody?: string;
  useranswered?: string;
  userid?: string;
  answeredon?: string;
}

export interface Question {
  _id: string;
  questiontitle?: string;
  questionbody?: string;
  questiontags?: string[];
  noofanswer?: number;
  upvote?: string[];
  downvote?: string[];
  userposted?: string;
  userid?: string;
  askedon?: string;
  createdAt?: string;
  updatedAt?: string;
  views?: number;
  answer?: Answer[];
}

const getQuestionTimestamp = (question: Question) => {
  const date = question.createdAt || question.askedon || question.updatedAt;
  return date ? new Date(date).getTime() : 0;
};

export const sortQuestionsByNewest = (questions: Question[]) => {
  return [...questions].sort(
    (first, second) => getQuestionTimestamp(second) - getQuestionTimestamp(first)
  );
};

export const getAllQuestions = async () => {
  const response = await axiosInstance.get("/questions");
  const questions = response.data.data ?? [];

  return sortQuestionsByNewest(questions);
};
