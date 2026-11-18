import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { config } from "./config.js";
import { AIError } from "./ai/index.js";

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email }, config.JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new HttpError(401, "Missing auth token"));
  try {
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET) as jwt.JwtPayload;
    req.user = { id: String(payload.sub), email: String(payload.email) };
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
}

/** The authenticated user. Only call inside routes guarded by requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, "Not authenticated");
  return req.user;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Invalid request", details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  }
  if (err instanceof HttpError || err instanceof AIError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err && typeof err === "object" && "code" in err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large (max 5 MB)" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
}
