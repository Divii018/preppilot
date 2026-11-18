import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import {
  ANALYSIS_SYSTEM,
  INTERVIEWER_SYSTEM,
  RESUME_SYSTEM,
  describeContext,
  describeHistory,
  type AnsweredTurn,
  type InterviewContext,
} from "./prompts.js";
import {
  FinalReportSchema,
  MatchAnalysisSchema,
  QuestionSchema,
  ResumeProfileSchema,
  TurnResultSchema,
  normalizeAnalysis,
  normalizeEvaluation,
  normalizeReport,
  toOutputSchema,
  type ResumeProfile,
} from "./schemas.js";
import type { AIProvider } from "./provider.js";
import { AIError } from "./provider.js";

const MODEL = "claude-opus-5-5";
type Effort = "low" | "medium" | "high";
type Content = Anthropic.Beta.BetaContentBlockParam[];

export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  private client: Anthropic;

  constructor(client = new Anthropic()) {
    this.client = client;
  }

  /**
   * One structured call: the model's output is constrained to `schema`, then validated with Zod.
   * Refusals fall back server-side to Anthropic's recommended model for that category.
   */
  private async structured<S extends z.ZodType>(opts: {
    system: string;
    content: Content;
    schema: S;
    effort: Effort;
  }): Promise<z.infer<S>> {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: opts.content }],
        output_config: {
          effort: opts.effort,
          format: { type: "json_schema", schema: toOutputSchema(opts.schema) },
        },
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) throw new AIError("AI is busy right now, please retry in a minute.", 429);
      if (err instanceof Anthropic.AuthenticationError) throw new AIError("AI provider is not configured correctly.", 503);
      if (err instanceof Anthropic.BadRequestError) throw new AIError(`AI request rejected: ${err.message}`, 502);
      if (err instanceof Anthropic.APIError) throw new AIError(`AI provider error (${err.status}).`, 502);
      if (err instanceof Anthropic.APIConnectionError) throw new AIError("Could not reach the AI provider.", 503);
      throw err;
    }

    if (response.stop_reason === "refusal") {
      throw new AIError("The AI declined to answer this request. Try rephrasing your input.", 422);
    }
    if (response.stop_reason === "max_tokens") {
      throw new AIError("The AI response was too long and got cut off. Try a shorter input.", 502);
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AIError("The AI returned malformed output.", 502);
    }
    const result = opts.schema.safeParse(json);
    if (!result.success) throw new AIError("The AI returned output in an unexpected shape.", 502);
    return result.data;
  }

  async extractResume(pdf: Buffer): Promise<ResumeProfile> {
    return this.structured({
      system: RESUME_SYSTEM,
      effort: "low",
      schema: ResumeProfileSchema,
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
        },
        { type: "text", text: "Extract this resume into the required structure." },
      ],
    });
  }

  async analyzeMatch(resume: ResumeProfile, jobTitle: string, jobDescription: string) {
    const out = await this.structured({
      system: ANALYSIS_SYSTEM,
      effort: "medium",
      schema: MatchAnalysisSchema,
      content: [
        {
          type: "text",
          text: `Job title: ${jobTitle}\n\nJob description:\n${jobDescription}\n\nCandidate resume (structured):\n${JSON.stringify(resume, null, 2)}\n\nAnalyse how well this resume fits the job.`,
        },
      ],
    });
    return normalizeAnalysis(out);
  }

  /** Interview context goes in its own cached block: it is identical on every turn of an interview. */
  private interviewContent(ctx: InterviewContext, instruction: string): Content {
    return [
      { type: "text", text: describeContext(ctx), cache_control: { type: "ephemeral" } },
      { type: "text", text: instruction },
    ];
  }

  async firstQuestion(ctx: InterviewContext) {
    return this.structured({
      system: INTERVIEWER_SYSTEM,
      effort: "low",
      schema: QuestionSchema,
      content: this.interviewContent(
        ctx,
        "Start the interview. Ask the first question; a short warm-up that still tells you something about the candidate is ideal.",
      ),
    });
  }

  async evaluateAndContinue(
    ctx: InterviewContext,
    history: AnsweredTurn[],
    current: { question: string; topic: string },
    answer: string,
    isLast: boolean,
  ) {
    const out = await this.structured({
      system: INTERVIEWER_SYSTEM,
      effort: "medium",
      schema: TurnResultSchema,
      content: this.interviewContent(
        ctx,
        [
          `Interview so far:\n${describeHistory(history)}`,
          `Current question (${history.length + 1} of ${ctx.totalQuestions}) [${current.topic}]: ${current.question}`,
          `Candidate answer:\n${answer}`,
          isLast
            ? "Evaluate this answer. This was the final question, so next_question must be null."
            : "Evaluate this answer, then ask the next question, adapting to how the candidate has done so far.",
        ].join("\n\n"),
      ),
    });
    return {
      evaluation: normalizeEvaluation(out.evaluation),
      next_question: isLast ? null : out.next_question,
    };
  }

  async finalReport(ctx: InterviewContext, history: AnsweredTurn[]) {
    const out = await this.structured({
      system: INTERVIEWER_SYSTEM,
      effort: "medium",
      schema: FinalReportSchema,
      content: this.interviewContent(
        ctx,
        `The interview is over. Full transcript with per-question scores:\n\n${describeHistory(history)}\n\nWrite the final debrief for the candidate. overall_score is 0-100 and should be consistent with the per-question scores.`,
      ),
    });
    return normalizeReport(out);
  }
}
