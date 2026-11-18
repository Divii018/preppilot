-- PrepPilot schema. Idempotent: safe to run on every start.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resumes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  profile     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resumes_user_idx ON resumes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id       UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_title       TEXT NOT NULL,
  company         TEXT,
  job_description TEXT NOT NULL,
  match_score     INT NOT NULL,
  result          JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analyses_user_idx ON analyses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS interviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id       UUID REFERENCES resumes(id) ON DELETE SET NULL,
  role            TEXT NOT NULL,
  job_description TEXT,
  interview_type  TEXT NOT NULL CHECK (interview_type IN ('technical', 'hr', 'mixed')),
  difficulty      TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  total_questions INT NOT NULL CHECK (total_questions BETWEEN 3 AND 10),
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  overall_score   INT,
  final_report    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS interviews_user_idx ON interviews(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS interview_turns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id  UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  idx           INT NOT NULL,
  question      TEXT NOT NULL,
  question_type TEXT NOT NULL,
  topic         TEXT NOT NULL,
  answer        TEXT,
  score         INT,
  evaluation    JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (interview_id, idx)
);
