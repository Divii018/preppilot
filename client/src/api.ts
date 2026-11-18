// Typed API client. Every request carries the JWT; a 401 logs the user out.

export interface User { id: string; name: string; email: string }

export interface ResumeProfile {
  name: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: { title: string; organization: string; duration: string; highlights: string[] }[];
  projects: { name: string; tech: string[]; description: string }[];
  education: { degree: string; institution: string; year: string; score: string }[];
  achievements: string[];
}
export interface Resume { id: string; filename: string; profile: ResumeProfile; created_at: string }

export interface MatchAnalysis {
  match_score: number;
  verdict: "strong_match" | "good_match" | "partial_match" | "weak_match";
  summary: string;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  gaps: string[];
  resume_suggestions: { section: string; suggestion: string }[];
  ats_keywords: string[];
  likely_interview_topics: string[];
}
export interface Analysis {
  id: string;
  resume_id: string;
  job_title: string;
  company: string | null;
  job_description?: string;
  match_score: number;
  result?: MatchAnalysis;
  created_at: string;
}

export interface Evaluation {
  score: number;
  rubric: { relevance: number; depth: number; clarity: number; correctness: number };
  strengths: string[];
  improvements: string[];
  model_answer_outline: string[];
}
export interface Turn {
  id: string;
  idx: number;
  question: string;
  question_type: string;
  topic: string;
  answer: string | null;
  score: number | null;
  evaluation: Evaluation | null;
}
export interface FinalReport {
  overall_score: number;
  hire_signal: "strong_yes" | "yes" | "lean_yes" | "lean_no" | "no";
  summary: string;
  top_strengths: string[];
  focus_areas: string[];
  recommended_topics: { topic: string; why: string }[];
}
export type InterviewType = "technical" | "hr" | "mixed";
export type Difficulty = "easy" | "medium" | "hard";
export interface Interview {
  id: string;
  role: string;
  job_description: string | null;
  resume_id: string | null;
  interview_type: InterviewType;
  difficulty: Difficulty;
  total_questions: number;
  status: "in_progress" | "completed";
  overall_score: number | null;
  final_report: FinalReport | null;
  created_at: string;
  completed_at: string | null;
}
export interface Stats {
  totals: {
    resumes: number;
    analyses: number;
    interviews_completed: number;
    avg_interview_score: number | null;
    best_match_score: number | null;
  };
  trend: { id: string; role: string; overall_score: number; completed_at: string }[];
  weakest_topics: { topic: string; avg_score: number; attempts: number }[];
}

const TOKEN_KEY = "preppilot_token";
export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string | null) => {
    try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const res = await fetch(`/api${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const detail = Array.isArray(data.details) ? `: ${data.details.join("; ")}` : "";
    throw new ApiError(res.status, (data.error ?? `Request failed (${res.status})`) + detail);
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) });

export const api = {
  register: (name: string, email: string, password: string) =>
    post<{ token: string; user: User }>("/auth/register", { name, email, password }),
  login: (email: string, password: string) => post<{ token: string; user: User }>("/auth/login", { email, password }),
  me: () => request<{ user: User }>("/auth/me"),

  listResumes: () => request<{ resumes: Resume[] }>("/resumes"),
  uploadResume: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return post<{ resume: Resume }>("/resumes", fd);
  },
  deleteResume: (id: string) => request<void>(`/resumes/${id}`, { method: "DELETE" }),

  listAnalyses: () => request<{ analyses: Analysis[] }>("/analyses"),
  getAnalysis: (id: string) => request<{ analysis: Analysis }>(`/analyses/${id}`),
  createAnalysis: (body: { resume_id: string; job_title: string; company?: string; job_description: string }) =>
    post<{ analysis: Analysis }>("/analyses", body),

  listInterviews: () => request<{ interviews: Interview[] }>("/interviews"),
  getInterview: (id: string) => request<{ interview: Interview; turns: Turn[] }>(`/interviews/${id}`),
  startInterview: (body: {
    role: string;
    job_description?: string;
    resume_id?: string;
    interview_type: InterviewType;
    difficulty: Difficulty;
    total_questions: number;
  }) => post<{ interview: Interview; turns: Turn[] }>("/interviews", body),
  answer: (id: string, answer: string) =>
    post<{ evaluation: Evaluation; interview: Interview; turns: Turn[] }>(`/interviews/${id}/answer`, { answer }),
  finish: (id: string) => post<{ interview: Interview; turns: Turn[] }>(`/interviews/${id}/finish`),

  stats: () => request<Stats>("/stats"),
};
