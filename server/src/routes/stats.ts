import { Router } from "express";
import { query } from "../db/index.js";
import { currentUser } from "../middleware.js";

export const statsRouter = Router();

/** Dashboard numbers: totals, score trend over completed interviews, and per-topic averages. */
statsRouter.get("/", async (req, res) => {
  const userId = currentUser(req).id;

  const [totals, trend, topics] = await Promise.all([
    query(
      `SELECT
         (SELECT count(*)::int FROM resumes WHERE user_id = $1)                                  AS resumes,
         (SELECT count(*)::int FROM analyses WHERE user_id = $1)                                 AS analyses,
         (SELECT count(*)::int FROM interviews WHERE user_id = $1 AND status = 'completed')      AS interviews_completed,
         (SELECT round(avg(overall_score))::int FROM interviews WHERE user_id = $1 AND status = 'completed') AS avg_interview_score,
         (SELECT max(match_score) FROM analyses WHERE user_id = $1)                              AS best_match_score`,
      [userId],
    ),
    query(
      `SELECT id, role, overall_score, completed_at FROM (
         SELECT id, role, overall_score, completed_at FROM interviews
         WHERE user_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 20
       ) recent ORDER BY completed_at ASC`,
      [userId],
    ),
    query(
      `SELECT t.topic, round(avg(t.score)::numeric, 1)::float AS avg_score, count(*)::int AS attempts
       FROM interview_turns t JOIN interviews i ON i.id = t.interview_id
       WHERE i.user_id = $1 AND t.score IS NOT NULL
       GROUP BY t.topic ORDER BY avg_score ASC LIMIT 8`,
      [userId],
    ),
  ]);

  res.json({ totals: totals.rows[0], trend: trend.rows, weakest_topics: topics.rows });
});
