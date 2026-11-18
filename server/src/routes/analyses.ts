import { Router } from "express";
import { z } from "zod";
import type { AIProvider } from "../ai/index.js";
import type { ResumeProfile } from "../ai/schemas.js";
import { query } from "../db/index.js";
import { HttpError, currentUser } from "../middleware.js";

const CreateBody = z.object({
  resume_id: z.uuid(),
  job_title: z.string().trim().min(2).max(150),
  company: z.string().trim().max(150).optional(),
  job_description: z.string().trim().min(50, "Paste the full job description (at least 50 characters)").max(20000),
});
const IdParam = z.object({ id: z.uuid() });

export function analysesRouter(ai: AIProvider) {
  const router = Router();

  router.post("/", async (req, res) => {
    const user = currentUser(req);
    const body = CreateBody.parse(req.body);
    const { rows: resumes } = await query<{ profile: ResumeProfile }>(
      "SELECT profile FROM resumes WHERE id = $1 AND user_id = $2",
      [body.resume_id, user.id],
    );
    if (!resumes[0]) throw new HttpError(404, "Resume not found");

    const result = await ai.analyzeMatch(resumes[0].profile, body.job_title, body.job_description);
    const { rows } = await query(
      `INSERT INTO analyses (user_id, resume_id, job_title, company, job_description, match_score, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, resume_id, job_title, company, match_score, result, created_at`,
      [user.id, body.resume_id, body.job_title, body.company ?? null, body.job_description, result.match_score, result],
    );
    res.status(201).json({ analysis: rows[0] });
  });

  router.get("/", async (req, res) => {
    const { rows } = await query(
      `SELECT id, resume_id, job_title, company, match_score, created_at
       FROM analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [currentUser(req).id],
    );
    res.json({ analyses: rows });
  });

  router.get("/:id", async (req, res) => {
    const { id } = IdParam.parse(req.params);
    const { rows } = await query(
      `SELECT id, resume_id, job_title, company, job_description, match_score, result, created_at
       FROM analyses WHERE id = $1 AND user_id = $2`,
      [id, currentUser(req).id],
    );
    if (!rows[0]) throw new HttpError(404, "Analysis not found");
    res.json({ analysis: rows[0] });
  });

  return router;
}
