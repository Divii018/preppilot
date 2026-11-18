import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, type Difficulty, type Interview, type InterviewType, type Resume } from "../api";
import { EmptyState, ErrorBox, PageHeader, Spinner, errMsg, fmtDate } from "../components/ui";

const TYPE_LABEL: Record<InterviewType, string> = { technical: "Technical", hr: "HR / Behavioural", mixed: "Mixed" };

export function InterviewList() {
  const [items, setItems] = useState<Interview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.listInterviews().then((r) => setItems(r.interviews)).catch((e) => setError(errMsg(e)));
  }, []);

  return (
    <>
      <PageHeader
        title="Mock Interviews"
        subtitle="Every answer is scored on relevance, depth, clarity and correctness."
        action={<Link to="/interviews/new" className="btn-primary">New interview</Link>}
      />
      <ErrorBox message={error} />
      {items === null ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <EmptyState title="No interviews yet" body="Start a mock interview tailored to your resume and target role." action={<Link to="/interviews/new" className="btn-primary">Start one</Link>} />
      ) : (
        <div className="card divide-y divide-slate-100 p-0">
          {items.map((iv) => (
            <Link key={iv.id} to={`/interviews/${iv.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50">
              <div>
                <div className="font-medium">{iv.role}</div>
                <div className="text-xs text-slate-500">
                  {TYPE_LABEL[iv.interview_type]} · {iv.difficulty} · {iv.total_questions} questions · {fmtDate(iv.created_at)}
                </div>
              </div>
              {iv.status === "completed" ? (
                <span className="text-lg font-bold">{iv.overall_score}<span className="text-xs font-normal text-slate-400">/100</span></span>
              ) : (
                <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-200">In progress, continue</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function Option<T extends string>({ value, current, set, children }: { value: T; current: T; set: (v: T) => void; children: string }) {
  return (
    <button type="button" onClick={() => set(value)} className={`btn flex-1 border ${current === value ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-600"}`}>
      {children}
    </button>
  );
}

interface Prefill { role?: string; job_description?: string; resume_id?: string }

export function InterviewSetup() {
  const navigate = useNavigate();
  const prefill = (useLocation().state ?? {}) as Prefill;
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [role, setRole] = useState(prefill.role ?? "");
  const [jd, setJd] = useState(prefill.job_description ?? "");
  const [resumeId, setResumeId] = useState(prefill.resume_id ?? "");
  const [type, setType] = useState<InterviewType>("mixed");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listResumes().then((r) => {
      setResumes(r.resumes);
      if (!prefill.resume_id && r.resumes[0]) setResumeId(r.resumes[0].id);
    }).catch(() => {});
  }, [prefill.resume_id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { interview } = await api.startInterview({
        role,
        job_description: jd || undefined,
        resume_id: resumeId || undefined,
        interview_type: type,
        difficulty,
        total_questions: count,
      });
      navigate(`/interviews/${interview.id}`);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }


  return (
    <>
      <PageHeader title="New mock interview" subtitle="The interviewer reads your resume and adapts each question to your previous answers." />
      <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-5">
        <ErrorBox message={error} />
        <div>
          <label className="label" htmlFor="role">Target role</label>
          <input id="role" className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Graduate Engineer Trainee, Java Developer" required />
        </div>
        <div>
          <label className="label" htmlFor="resume">Resume</label>
          <select id="resume" className="input" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
            <option value="">No resume (generic questions)</option>
            {resumes.map((r) => <option key={r.id} value={r.id}>{r.profile.name || r.filename}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Interview type</span>
          <div className="flex gap-2">
            <Option value="technical" current={type} set={setType}>Technical</Option>
            <Option value="hr" current={type} set={setType}>HR</Option>
            <Option value="mixed" current={type} set={setType}>Mixed</Option>
          </div>
        </div>
        <div>
          <span className="label">Difficulty</span>
          <div className="flex gap-2">
            <Option value="easy" current={difficulty} set={setDifficulty}>Easy</Option>
            <Option value="medium" current={difficulty} set={setDifficulty}>Medium</Option>
            <Option value="hard" current={difficulty} set={setDifficulty}>Hard</Option>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="count">Number of questions: {count}</label>
          <input id="count" type="range" min={3} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-indigo-600" />
        </div>
        <div>
          <label className="label" htmlFor="jd">Job description (optional, makes questions more targeted)</label>
          <textarea id="jd" className="input min-h-32" value={jd} onChange={(e) => setJd(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Preparing your interviewer…" : "Start interview"}</button>
      </form>
    </>
  );
}
