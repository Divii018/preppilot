import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db/index.js";
import { HttpError, currentUser, requireAuth, signToken } from "../middleware.js";

const RegisterBody = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});
const LoginBody = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const body = RegisterBody.parse(req.body);
  const hash = await bcrypt.hash(body.password, 10);
  const { rows } = await query<{ id: string; name: string; email: string }>(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING RETURNING id, name, email`,
    [body.name, body.email, hash],
  );
  if (rows.length === 0) throw new HttpError(409, "An account with this email already exists");
  const user = rows[0];
  res.status(201).json({ token: signToken(user), user });
});

authRouter.post("/login", async (req, res) => {
  const body = LoginBody.parse(req.body);
  const { rows } = await query<{ id: string; name: string; email: string; password_hash: string }>(
    "SELECT id, name, email, password_hash FROM users WHERE email = $1",
    [body.email],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    throw new HttpError(401, "Incorrect email or password");
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT id, name, email, created_at FROM users WHERE id = $1", [currentUser(req).id]);
  if (!rows[0]) throw new HttpError(404, "User not found");
  res.json({ user: rows[0] });
});
