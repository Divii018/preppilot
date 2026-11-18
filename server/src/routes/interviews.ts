import { Router } from "express";
import { z } from "zod";
import type { AIProvider } from "../ai/index.js";
import type { AnsweredTurn, InterviewContext } from "../ai/prompts.js";
import type { ResumeProfile } from "../ai/schemas.js";
import { query, withTransaction } from "../db/index.js";
import { HttpError, currentUser } from "../middleware.js";

const CreateBody = z.object({
  role: z.string().trim().min(2).max(150),
  job_description: z.string().trim().max(20000).optional(),
  resume_id: z.uuid().optional(),
  interview_type: z.enum(["technical", "hr", "mixed"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  total_questions: z.number().int().min(3).max(10),
});
const AnswerBody = z.object({ answer: z.string().trim().min(1, "Answer cannot be empty").max(5000) });
const IdParam = z.object({ id: z.uuid() });

interface InterviewRow {
  id: string;
  user_id: string;
  role: string;
  job_description: string | null;
  interview_type: InterviewContext["interviewType"];
  difficulty: InterviewContext["difficulty"];
  total_questions: number;
  status: "in_progress" | "completed";
  profile: ResumeProfile | null;
}
interface TurnRow {
  id: string;
  idx: number;
  question: string;
  question_type: string;
  topic: string;
  answer: string | null;
  score: number | null;
  evaluation: unknown;
}

const toContext = (iv: InterviewRow): InterviewContext => ({
  role: iv.role,
  jobDescription: iv.job_description,
  interviewType: iv.interview_type,
  difficulty: iv.difficulty,
  totalQuestions: iv.total_questions,
  resume: iv.profile,
});

const answered = (turns: TurnRow[]): AnsweredTurn[] =>
  turns
    .filter((t) => t.answer !== null && t.score !== null)
    .map((t) => ({ question: t.question, topic: t.topic, answer: t.answer!, score: t.score! }));

export function interviewsRouter(ai: AIProvider) {
  const router = Router();

  async function load(id: string, userId: string) {
    const { rows } = await query<InterviewRow>(
      `SELECT i.*, r.profile FROM interviews i LEFT JOIN resumes r ON r.id = i.resume_id
       WHERE i.id = $1 AND i.user_id = $2`,
      [id, userId],
    );
    if (!rows[0]) throw new HttpError(404, "Interview not found");
    const { rows: turns } = await query<TurnRow>(
      `SELECT id, idx, question, question_type, topic, answer, score, evaluation
       FROM interview_turns WHERE interview_id = $1 ORDER BY idx`,
      [id],
    );
    return { interview: rows[0], turns };
  }

  async function finalize(interview: InterviewRow, turns: TurnRow[]) {
    const history = answered(turns);
    const report = await ai.finalReport(toContext(interview), history);
    await withTransaction(async (db) => {
      // Drop the unanswered question when an interview is ended early.
      await db.query("DELETE FROM interview_turns WHERE interview_id = $1 AND answer IS NULL", [interview.id]);
      await db.query(
        `UPDATE interviews SET status = 'completed', overall_score = $2, final_report = $3, completed_at = now()
         WHERE id = $1`,
        [interview.id, report.overall_score, report],
      );
    });
    return report;
  }

  router.post("/", async (req, res) => {
    const user = currentUser(req);
    const body = CreateBody.parse(req.body);

    let profile: ResumeProfile | null = null;
    if (body.resume_id) {
      const { rows } = await query<{ profile: ResumeProfile }>(
        "SELECT profile FROM resumes WHERE id = $1 AND user_id = $2",
        [body.resume_id, user.id],
      );
      if (!rows[0]) throw new HttpError(404, "Resume not found");
      profile = rows[0].profile;
    }

    const ctx: InterviewContext = {
      role: body.role,
      jobDescription: body.job_description || null,
      interviewType: body.interview_type,
      difficulty: body.difficulty,
      totalQuestions: body.total_questions,
      resume: profile,
    };
    const first = await ai.firstQuestion(ctx);

    const id = await withTransaction(async (db) => {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO interviews (user_id, resume_id, role, job_description, interview_type, difficulty, total_questions)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [user.id, body.resume_id ?? null, ctx.role, ctx.jobDescription, ctx.interviewType, ctx.difficulty, ctx.totalQuestions],
      );
      await db.query(
        "INSERT INTO interview_turns (interview_id, idx, question, question_type, topic) VALUES ($1, 0, $2, $3, $4)",
        [rows[0].id, first.question, first.question_type, first.topic],
      );
      return rows[0].id;
    });

    const { interview, turns } = await load(id, user.id);
    res.status(201).json({ interview: publicInterview(interview), turns });
  });

  router.get("/", async (req, res) => {
    const { rows } = await query(
      `SELECT id, role, interview_type, difficulty, total_questions, status, overall_score, created_at, completed_at
       FROM interviews WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [currentUser(req).id],
    );
    res.json({ interviews: rows });
  });

  router.get("/:id", async (req, res) => {
    const { id } = IdParam.parse(req.params);
    const { interview, turns } = await load(id, currentUser(req).id);
    res.json({ interview: publicInterview(interview), turns });
  });

  router.post("/:id/answer", async (req, res) => {
    const user = currentUser(req);
    const { id } = IdParam.parse(req.params);
    const { answer } = AnswerBody.parse(req.body);
    const { interview, turns } = await load(id, user.id);
    if (interview.status !== "in_progress") throw new HttpError(409, "This interview is already finished");

    const current = turns.find((t) => t.answer === null);
    if (!current) throw new HttpError(409, "No open question to answer");
    const isLast = current.idx + 1 >= interview.total_questions;

    const { evaluation, next_question } = await ai.evaluateAndContinue(
      toContext(interview),
      answered(turns),
      { question: current.question, topic: current.topic },
      answer,
      isLast,
    );

    await withTransaction(async (db) => {
      // `answer IS NULL` guards against a double submit racing this request.
      const upd = await db.query(
        "UPDATE interview_turns SET answer = $2, score = $3, evaluation = $4 WHERE id = $1 AND answer IS NULL",
        [current.id, answer, evaluation.score, evaluation],
      );
      if (upd.rowCount === 0) throw new HttpError(409, "This question was already answered");
      if (next_question) {
        await db.query(
          "INSERT INTO interview_turns (interview_id, idx, question, question_type, topic) VALUES ($1, $2, $3, $4, $5)",
          [id, current.idx + 1, next_question.question, next_question.question_type, next_question.topic],
        );
      }
    });

    if (isLast) {
      const fresh = await load(id, user.id);
      await finalize(fresh.interview, fresh.turns);
    }
    const result = await load(id, user.id);
    res.json({ evaluation, interview: publicInterview(result.interview), turns: result.turns });
  });

  router.post("/:id/finish", async (req, res) => {
    const user = currentUser(req);
    const { id } = IdParam.parse(req.params);
    const { interview, turns } = await load(id, user.id);
    if (interview.status !== "in_progress") throw new HttpError(409, "This interview is already finished");
    if (answered(turns).length === 0) throw new HttpError(400, "Answer at least one question before finishing");
    await finalize(interview, turns);
    const result = await load(id, user.id);
    res.json({ interview: publicInterview(result.interview), turns: result.turns });
  });

  return router;
}

function publicInterview(iv: InterviewRow) {
  const { profile: _profile, user_id: _userId, ...rest } = iv;
  return rest;
}
