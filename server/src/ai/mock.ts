import type { AIProvider } from "./provider.js";
import type { AnsweredTurn, InterviewContext } from "./prompts.js";
import type { Evaluation, FinalReport, MatchAnalysis, Question, ResumeProfile } from "./schemas.js";

/**
 * Deterministic offline provider. Used when AI_MOCK=true (local demos without an API key)
 * and in automated tests. Scores are simple heuristics so the UI behaves realistically.
 */

const QUESTION_BANK: Record<"technical" | "hr", Question[]> = {
  technical: [
    { question: "Walk me through a project on your resume you're most proud of. What was your exact contribution?", question_type: "project", topic: "Project deep-dive" },
    { question: "How does JWT authentication work, and where would you store the token in a web app?", question_type: "technical", topic: "Authentication" },
    { question: "Explain the difference between a process and a thread.", question_type: "technical", topic: "Operating systems" },
    { question: "How would you find the first non-repeating character in a string? What's the time complexity?", question_type: "problem_solving", topic: "Strings & hashing" },
    { question: "What happens when you type a URL into the browser and press Enter?", question_type: "technical", topic: "Networking" },
    { question: "When would you choose SQL over a NoSQL database like MongoDB?", question_type: "technical", topic: "Databases" },
    { question: "Explain how React decides when to re-render a component.", question_type: "technical", topic: "React rendering" },
    { question: "What are the four pillars of OOP? Give an example of polymorphism in Java.", question_type: "technical", topic: "OOP" },
    { question: "How would you design a URL shortener at a high level?", question_type: "problem_solving", topic: "System design" },
    { question: "What is the difference between an index and a primary key in a database?", question_type: "technical", topic: "Database indexing" },
  ],
  hr: [
    { question: "Tell me about yourself in under two minutes.", question_type: "hr", topic: "Introduction" },
    { question: "Describe a time you disagreed with a teammate. How did you resolve it?", question_type: "behavioral", topic: "Conflict resolution" },
    { question: "Why do you want to join our company?", question_type: "hr", topic: "Motivation" },
    { question: "Tell me about a time you failed. What did you learn?", question_type: "behavioral", topic: "Learning from failure" },
    { question: "Are you comfortable relocating or working in shifts?", question_type: "hr", topic: "Flexibility" },
    { question: "Describe a situation where you had to learn something new quickly.", question_type: "behavioral", topic: "Learning agility" },
    { question: "Where do you see yourself in three years?", question_type: "hr", topic: "Career goals" },
    { question: "Tell me about a time you led a team or took ownership.", question_type: "behavioral", topic: "Leadership" },
    { question: "How do you handle tight deadlines?", question_type: "behavioral", topic: "Time management" },
    { question: "What is your biggest strength and one weakness?", question_type: "hr", topic: "Self-awareness" },
  ],
};

function pickQuestion(ctx: InterviewContext, index: number): Question {
  const pool =
    ctx.interviewType === "mixed"
      ? index % 5 === 1 || index % 5 === 3
        ? QUESTION_BANK.hr
        : QUESTION_BANK.technical
      : QUESTION_BANK[ctx.interviewType === "hr" ? "hr" : "technical"];
  return pool[index % pool.length];
}

export function heuristicScore(answer: string): number {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  let score = Math.min(7, 1 + Math.floor(words / 12)); // length up to ~70 words
  if (/\b(for example|for instance|e\.g\.|such as)\b/i.test(answer)) score += 1; // concrete example
  if (/\d/.test(answer)) score += 1; // quantified detail
  if (/\b(because|therefore|trade-?off|so that)\b/i.test(answer)) score += 1; // reasoning
  return Math.min(10, score);
}

const SAMPLE_PROFILE: ResumeProfile = {
  name: "Sample Candidate",
  headline: "Engineering graduate | Full-stack developer",
  summary: "Recent engineering graduate with hands-on experience building full-stack web applications and embedded prototypes.",
  skills: ["C++", "Java", "JavaScript", "React", "Node.js", "Express.js", "MongoDB", "HTML", "CSS", "Python"],
  experience: [
    { title: "Intern", organization: "Manufacturing company", duration: "1 month", highlights: ["Observed production line processes and SAP line-feed operations"] },
  ],
  projects: [
    { name: "Workflow Manager", tech: ["React", "Node.js", "MongoDB", "JWT"], description: "Role-based workflow management web app." },
  ],
  education: [{ degree: "B.E.", institution: "Engineering College", year: "2026", score: "8.3 CGPA" }],
  achievements: ["Third place in a hackathon"],
};

export class MockProvider implements AIProvider {
  readonly name = "mock";

  async extractResume(_pdf: Buffer): Promise<ResumeProfile> {
    return structuredClone(SAMPLE_PROFILE);
  }

  async analyzeMatch(resume: ResumeProfile, _jobTitle: string, jobDescription: string): Promise<MatchAnalysis> {
    const jd = jobDescription.toLowerCase();
    const matched = resume.skills.filter((s) => jd.includes(s.toLowerCase()));
    const commonAsks = ["Docker", "AWS", "SQL", "Git", "TypeScript", "Spring Boot", "REST", "Kubernetes", "Python", "Java"];
    const missing = commonAsks.filter(
      (s) => jd.includes(s.toLowerCase()) && !resume.skills.some((r) => r.toLowerCase() === s.toLowerCase()),
    );
    const total = matched.length + missing.length;
    const score = total === 0 ? 55 : Math.round(40 + (60 * matched.length) / total);
    return {
      match_score: score,
      verdict: score >= 85 ? "strong_match" : score >= 70 ? "good_match" : score >= 55 ? "partial_match" : "weak_match",
      summary: `The resume matches ${matched.length} of the ${total || "few"} key skills detected in the job description.`,
      matched_skills: matched,
      missing_skills: missing,
      strengths: ["Hands-on full-stack project experience", "Strong academic record"],
      gaps: missing.length ? [`No evidence of ${missing.join(", ")}`] : ["Limited professional experience"],
      resume_suggestions: [
        { section: "Projects", suggestion: "Add a measurable outcome to each project, e.g. number of users or response time." },
        { section: "Skills", suggestion: "Group skills into Languages, Frameworks and Tools so recruiters can scan them quickly." },
      ],
      ats_keywords: [...matched, ...missing].slice(0, 10),
      likely_interview_topics: ["Project deep-dive", "OOP", "Databases", "Problem solving"],
    };
  }

  async firstQuestion(ctx: InterviewContext): Promise<Question> {
    return pickQuestion(ctx, 0);
  }

  async evaluateAndContinue(
    ctx: InterviewContext,
    history: AnsweredTurn[],
    _current: { question: string; topic: string },
    answer: string,
    isLast: boolean,
  ): Promise<{ evaluation: Evaluation; next_question: Question | null }> {
    const score = heuristicScore(answer);
    const evaluation: Evaluation = {
      score,
      rubric: { relevance: Math.min(10, score + 1), depth: score, clarity: Math.min(10, score + 1), correctness: score },
      strengths: score >= 6 ? ["Clear, well-structured answer"] : ["Attempted the question"],
      improvements:
        score >= 8
          ? ["Mention a trade-off or alternative approach to show depth"]
          : ["Add a concrete example from your own projects", "Explain the reasoning behind your approach"],
      model_answer_outline: ["Define the core concept", "Give a concrete example", "Discuss trade-offs", "Relate it to your own experience"],
    };
    return { evaluation, next_question: isLast ? null : pickQuestion(ctx, history.length + 1) };
  }

  async finalReport(_ctx: InterviewContext, history: AnsweredTurn[]): Promise<FinalReport> {
    const avg = history.length ? history.reduce((s, t) => s + t.score, 0) / history.length : 0;
    const overall = Math.round(avg * 10);
    const weakest = [...history].sort((a, b) => a.score - b.score).slice(0, 2);
    return {
      overall_score: overall,
      hire_signal: overall >= 80 ? "strong_yes" : overall >= 65 ? "yes" : overall >= 50 ? "lean_yes" : overall >= 35 ? "lean_no" : "no",
      summary: `You averaged ${avg.toFixed(1)}/10 across ${history.length} questions.`,
      top_strengths: ["Willingness to engage with every question"],
      focus_areas: weakest.map((t) => t.topic),
      recommended_topics: weakest.map((t) => ({ topic: t.topic, why: `You scored ${t.score}/10 on this question.` })),
    };
  }
}
