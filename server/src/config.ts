import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().default("postgres://preppilot:preppilot@localhost:5432/preppilot"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters").default("dev-secret-change-me-please"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  AI_MOCK: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const config = parsed.data;

if (config.NODE_ENV === "production" && config.JWT_SECRET === "dev-secret-change-me-please") {
  console.error("Refusing to start in production with the default JWT_SECRET.");
  process.exit(1);
}
