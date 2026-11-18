import { z } from "zod";

/**
 * Every AI response is constrained by a JSON schema (structured outputs) and then
 * validated again with Zod, so the rest of the app only ever sees typed, trusted data.
 * Numeric scores are plain numbers in the schema and clamped/rounded in `normalize*`.
 */

export const ResumeProfileSchema = z.object({
  name: z.string(),
  headline: z.string().describe("One-line professional headline, e.g. 'ECE graduate | Full-stack developer'"),
  summary: z.string().describe("2-3 sentence summary of the candidate"),
  skills: z.array(z.string()).describe("Distinct technical skills, tools, languages and frameworks"),
  experience: z.array(
    z.object({
      title: z.string(),
      organization: z.string(),
      duration: z.string(),
      highlights: z.array(z.string()),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      tech: z.array(z.string()),
      description: z.string(),
    }),
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.string(),
      score: z.string(),
    }),
  ),
  achievements: z.array(z.string()),
});
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;

export const MatchAnalysisSchema = z.object({
  match_score: z.number().describe("0-100 overall fit of the resume for this job"),
  verdict: z.enum(["strong_match", "good_match", "partial_match", "weak_match"]),
  summary: z.string().describe("2-3 sentences explaining the score"),
  matched_skills: z.array(z.string()),
  missing_skills: z.array(z.string()).describe("Skills the job asks for that the resume does not show"),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  resume_suggestions: z.array(
    z.object({
      section: z.string().describe("Resume section, e.g. 'Projects' or 'Skills'"),
      suggestion: z.string().describe("A concrete, specific edit the candidate can make"),
    }),
  ),
  ats_keywords: z.array(z.string()).describe("Keywords from the job description to include for ATS screening"),
  likely_interview_topics: z.array(z.string()),
});
export type MatchAnalysis = z.infer<typeof MatchAnalysisSchema>;

export const QuestionSchema = z.object({
  question: z.string(),
  question_type: z.enum(["technical", "behavioral", "project", "hr", "problem_solving"]),
  topic: z.string().describe("Short topic label, e.g. 'React state management'"),
});
export type Question = z.infer<typeof QuestionSchema>;

export const EvaluationSchema = z.object({
  score: z.number().describe("0-10 overall score for this answer"),
  rubric: z.object({
    relevance: z.number().describe("0-10: does it answer what was asked"),
    depth: z.number().describe("0-10: technical depth / specificity"),
    clarity: z.number().describe("0-10: structure and communication"),
    correctness: z.number().describe("0-10: factual / technical accuracy"),
  }),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  model_answer_outline: z.array(z.string()).describe("3-5 bullet points a strong answer would cover"),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const TurnResultSchema = z.object({
  evaluation: EvaluationSchema,
  next_question: QuestionSchema.nullable().describe("null when this was the final question"),
});
export type TurnResult = z.infer<typeof TurnResultSchema>;

export const FinalReportSchema = z.object({
  overall_score: z.number().describe("0-100"),
  hire_signal: z.enum(["strong_yes", "yes", "lean_yes", "lean_no", "no"]),
  summary: z.string(),
  top_strengths: z.array(z.string()),
  focus_areas: z.array(z.string()),
  recommended_topics: z.array(
    z.object({
      topic: z.string(),
      why: z.string(),
    }),
  ),
});
export type FinalReport = z.infer<typeof FinalReportSchema>;

// ---------- helpers ----------

const clamp = (n: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, n)));

export function normalizeEvaluation(e: Evaluation): Evaluation {
  return {
    ...e,
    score: clamp(e.score, 0, 10),
    rubric: {
      relevance: clamp(e.rubric.relevance, 0, 10),
      depth: clamp(e.rubric.depth, 0, 10),
      clarity: clamp(e.rubric.clarity, 0, 10),
      correctness: clamp(e.rubric.correctness, 0, 10),
    },
  };
}

export function normalizeAnalysis(a: MatchAnalysis): MatchAnalysis {
  return { ...a, match_score: clamp(a.match_score, 0, 100) };
}

export function normalizeReport(r: FinalReport): FinalReport {
  return { ...r, overall_score: clamp(r.overall_score, 0, 100) };
}

/** Convert a Zod schema into the JSON-schema shape structured outputs expects. */
export function toOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete json.$schema;
  return closeObjects(json) as Record<string, unknown>;
}

function closeObjects(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(closeObjects);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = closeObjects(v);
    if (out.type === "object") out.additionalProperties = false;
    return out;
  }
  return node;
}
