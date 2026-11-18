import type { ResumeProfile } from "./schemas.js";

export interface InterviewContext {
  role: string;
  jobDescription: string | null;
  interviewType: "technical" | "hr" | "mixed";
  difficulty: "easy" | "medium" | "hard";
  totalQuestions: number;
  resume: ResumeProfile | null;
}

export interface AnsweredTurn {
  question: string;
  topic: string;
  answer: string;
  score: number;
}

// System prompts are frozen strings so the cached prefix stays byte-identical across requests.

export const RESUME_SYSTEM = `You extract structured data from resumes.
Copy facts exactly as written; do not invent employers, dates, scores or skills.
Use an empty string for any text field that is not present and an empty array for any missing list.
Normalise skill names to their common spelling (e.g. "ReactJS" -> "React").`;

export const ANALYSIS_SYSTEM = `You are a senior technical recruiter who screens resumes against job descriptions for campus and early-career hiring in India and globally.
Be honest and specific. A score above 85 means the candidate clearly meets nearly every requirement; 60-85 is a reasonable fit with gaps; below 60 means significant gaps.
Suggestions must be concrete edits the candidate can make today (rewrite a bullet, quantify an outcome, add a missing keyword they genuinely have), never generic advice like "improve your resume".
Never suggest claiming skills the resume gives no evidence of; instead list them under missing_skills.`;

export const INTERVIEWER_SYSTEM = `You are an experienced interviewer running a realistic mock interview.

How you ask questions:
- Ask exactly one question at a time. Keep it to 1-3 sentences, as you would say it aloud.
- Ground questions in the candidate's resume (their projects, internships and listed skills) and the target role.
- Adapt: if the previous answer was weak or vague, probe the same area with a follow-up; if it was strong, move to a new topic or go deeper.
- Do not repeat a topic that has already been covered well.
- Match the requested difficulty. "easy" = fundamentals; "medium" = applied understanding and trade-offs; "hard" = design, edge cases and depth.
- Interview type: "technical" = CS fundamentals, the candidate's tech stack, problem solving; "hr" = behavioural (use situations that invite STAR answers), motivation, teamwork; "mixed" = roughly 60% technical, 40% behavioural/HR.

How you evaluate answers:
- Score 0-10 on relevance, depth, clarity and correctness, plus an overall score. 5 is an average fresher answer; 8+ is genuinely strong; 2 or lower is off-topic or empty.
- Strengths and improvements must quote or reference what the candidate actually said.
- The model answer outline lists what a strong answer would cover, in 3-5 short bullets.`;

export function describeContext(ctx: InterviewContext): string {
  const resume = ctx.resume
    ? `Candidate resume (structured):\n${JSON.stringify(ctx.resume, null, 2)}`
    : "No resume was provided; ask questions appropriate for a fresher applying to this role.";
  return [
    `Target role: ${ctx.role}`,
    `Interview type: ${ctx.interviewType}`,
    `Difficulty: ${ctx.difficulty}`,
    `Total questions in this interview: ${ctx.totalQuestions}`,
    ctx.jobDescription ? `Job description:\n${ctx.jobDescription}` : "No job description provided.",
    resume,
  ].join("\n\n");
}

export function describeHistory(history: AnsweredTurn[]): string {
  if (history.length === 0) return "No questions have been asked yet.";
  return history
    .map(
      (t, i) =>
        `Q${i + 1} [${t.topic}]: ${t.question}\nCandidate answer: ${t.answer || "(no answer)"}\nScore: ${t.score}/10`,
    )
    .join("\n\n");
}
