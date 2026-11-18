import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { config } from "./config.js";
import type { AIProvider } from "./ai/index.js";
import { errorHandler, requireAuth } from "./middleware.js";
import { authRouter } from "./routes/auth.js";
import { resumesRouter } from "./routes/resumes.js";
import { analysesRouter } from "./routes/analyses.js";
import { interviewsRouter } from "./routes/interviews.js";
import { statsRouter } from "./routes/stats.js";

export function createApp(ai: AIProvider) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));
  if (config.NODE_ENV !== "test") app.use(morgan("dev"));

  const isTest = config.NODE_ENV === "test";
  // Login/register: slow down credential stuffing.
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, skip: () => isTest });
  // AI-backed writes are the expensive calls: cap them per user.
  const aiLimiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 60,
    skip: (req) => isTest || req.method === "GET",
    keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? "0.0.0.0"),
    message: { error: "Hourly AI usage limit reached. Please try again later." },
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true, ai: ai.name }));
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/resumes", requireAuth, aiLimiter, resumesRouter(ai));
  app.use("/api/analyses", requireAuth, aiLimiter, analysesRouter(ai));
  app.use("/api/interviews", requireAuth, aiLimiter, interviewsRouter(ai));
  app.use("/api/stats", requireAuth, statsRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);
  return app;
}
