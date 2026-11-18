import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Analysis, type Resume } from "../api";
import { BulletList, Chips, EmptyState, ErrorBox, PageHeader, ScoreRing, Spinner, errMsg, fmtDate } from "../components/ui";

const VERDICT: Record<string, string> = {
  strong_match: "Strong match",
  good_match: "Good match",
  partial_match: "Partial match",
  weak_match: "Weak match",
};

export function AnalysesPage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listResumes(), api.listAnalyses()])
      .then(([r, a]) => {
        setResumes(r.resumes);
        setResumeId(r.resumes[0]?.id ?? "");
        setHistory(a.analyses);
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { analysis } = await api.createAnalysis({
        resume_id: resumeId,
        job_title: jobTitle,
        company: company || undefined,
        job_description: jd,
      });
      navigate(`/analyses/${analysis.id}`);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  if (resumes === null) return error ? <ErrorBox message={error} /> : <Spinner label="Loading…" />;
  if (resumes.length === 0)
    return (
      <EmptyState
        title="Upload a resume first"
        body="Job matching compares your resume against a job description."
        action={<Link className="btn-primary" to="/resumes">Go to resumes</Link>}
      />
    );

  return (
    <>
      <PageHeader title="Job Match" subtitle="Paste a job description to see how well your resume fits and what to fix." />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={submit} className="card space-y-4 lg:col-span-2">
          <ErrorBox message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="title">Job title</label>
              <input id="title" className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Graduate Engineer Trainee" required />
            </div>
            <div>
              <label className="label" htmlFor="company">Company (optional)</label>
              <input id="company" className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="resume">Resume</label>
            <select id="resume" className="input" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>{r.profile.name || r.filename} · {fmtDate(r.created_at)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="jd">Job description</label>
            <textarea id="jd" className="input min-h-56" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job description here…" required minLength={50} />
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? "Analysing…" : "Analyse match"}</button>
          {busy && <Spinner label="Comparing your resume with the job description…" />}
        </form>

        <div className="card">
          <h2 className="font-semibold">Past matches</h2>
          {history.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No matches yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {history.map((a) => (
                <li key={a.id}>
                  <Link to={`/analyses/${a.id}`} className="flex items-center justify-between gap-2 py-3 hover:text-indigo-600">
                    <div>
                      <div className="text-sm font-medium">{a.job_title}</div>
                      <div className="text-xs text-slate-400">{a.company ? `${a.company} · ` : ""}{fmtDate(a.created_at)}</div>
                    </div>
                    <span className="text-sm font-semibold">{a.match_score}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export function AnalysisView() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) api.getAnalysis(id).then((r) => setAnalysis(r.analysis)).catch((e) => setError(errMsg(e)));
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!analysis?.result) return <Spinner label="Loading…" />;
  const r = analysis.result;

  return (
    <>
      <PageHeader
        title={analysis.job_title}
        subtitle={`${analysis.company ? analysis.company + " · " : ""}${fmtDate(analysis.created_at)}`}
        action={
          <Link
            to="/interviews/new"
            state={{ role: analysis.job_title, job_description: analysis.job_description, resume_id: analysis.resume_id }}
            className="btn-primary"
          >
            Practise interview for this job
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card flex flex-col items-center text-center">
          <ScoreRing value={r.match_score} size={140} label="match" />
          <div className="mt-3 font-semibold">{VERDICT[r.verdict]}</div>
          <p className="mt-2 text-sm text-slate-600">{r.summary}</p>
        </div>
        <div className="card space-y-5 lg:col-span-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-500">Skills you have</h3>
            <Chips items={r.matched_skills} tone="green" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-500">Skills missing from your resume</h3>
            <Chips items={r.missing_skills} tone="red" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-500">ATS keywords to include</h3>
            <Chips items={r.ats_keywords} />
          </div>
        </div>
        <div className="card">
          <h3 className="mb-3 font-semibold">Strengths</h3>
          <BulletList items={r.strengths} />
          <h3 className="mb-3 mt-6 font-semibold">Gaps</h3>
          <BulletList items={r.gaps} />
        </div>
        <div className="card lg:col-span-2">
          <h3 className="mb-3 font-semibold">How to improve your resume for this job</h3>
          <ul className="space-y-3">
            {r.resume_suggestions.map((s, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                <span className="chip mr-2 bg-indigo-100 text-indigo-700">{s.section}</span>
                {s.suggestion}
              </li>
            ))}
          </ul>
          <h3 className="mb-2 mt-6 font-semibold">Topics you'll probably be asked about</h3>
          <Chips items={r.likely_interview_topics} tone="indigo" />
        </div>
      </div>
    </>
  );
}
