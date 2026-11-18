import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { AIProvider } from "../ai/index.js";
import { query } from "../db/index.js";
import { HttpError, currentUser } from "../middleware.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const IdParam = z.object({ id: z.uuid() });

export function resumesRouter(ai: AIProvider) {
  const router = Router();

  router.post("/", upload.single("file"), async (req, res) => {
    const user = currentUser(req);
    const file = req.file;
    if (!file) throw new HttpError(400, "Upload a PDF in the 'file' field");
    // Check the PDF magic bytes, not just the client-supplied MIME type.
    if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new HttpError(400, "Only PDF resumes are supported");

    const profile = await ai.extractResume(file.buffer);
    const { rows } = await query(
      "INSERT INTO resumes (user_id, filename, profile) VALUES ($1, $2, $3) RETURNING id, filename, profile, created_at",
      [user.id, file.originalname.slice(0, 200), profile],
    );
    res.status(201).json({ resume: rows[0] });
  });

  router.get("/", async (req, res) => {
    const { rows } = await query(
      "SELECT id, filename, profile, created_at FROM resumes WHERE user_id = $1 ORDER BY created_at DESC",
      [currentUser(req).id],
    );
    res.json({ resumes: rows });
  });

  router.delete("/:id", async (req, res) => {
    const { id } = IdParam.parse(req.params);
    const { rowCount } = await query("DELETE FROM resumes WHERE id = $1 AND user_id = $2", [id, currentUser(req).id]);
    if (!rowCount) throw new HttpError(404, "Resume not found");
    res.status(204).end();
  });

  return router;
}
