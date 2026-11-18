import type { AnsweredTurn, InterviewContext } from "./prompts.js";
import type { Evaluation, FinalReport, MatchAnalysis, Question, ResumeProfile } from "./schemas.js";

export interface AIProvider {
  readonly name: string;
  extractResume(pdf: Buffer): Promise<ResumeProfile>;
  analyzeMatch(resume: ResumeProfile, jobTitle: string, jobDescription: string): Promise<MatchAnalysis>;
  firstQuestion(ctx: InterviewContext): Promise<Question>;
  evaluateAndContinue(
    ctx: InterviewContext,
    history: AnsweredTurn[],
    current: { question: string; topic: string },
    answer: string,
    isLast: boolean,
  ): Promise<{ evaluation: Evaluation; next_question: Question | null }>;
  finalReport(ctx: InterviewContext, history: AnsweredTurn[]): Promise<FinalReport>;
}

/** An error from the AI layer with an HTTP status the API should return. */
export class AIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AIError";
  }
}
