import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type Stats } from "../api";
import { useAuth } from "../auth";
import { EmptyState, ErrorBox, PageHeader, Spinner, errMsg, fmtDate } from "../components/ui";

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <Spinner label="Loading your dashboard…" />;

  const { totals, trend, weakest_topics } = stats;
  const fresh = totals.resumes === 0;
  const chartData = trend.map((t, i) => ({ n: i + 1, score: t.overall_score, role: t.role, date: fmtDate(t.completed_at) }));

  return (
    <>
      <PageHeader
        title={`Hi, ${user?.name.split(" ")[0]}`}
        subtitle="Here's how your interview prep is going."
        action={<Link to="/interviews/new" className="btn-primary">Start mock interview</Link>}
      />

      {fresh && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="font-semibold text-indigo-900">Get started in 3 steps</h2>
          <ol className="mt-3 grid gap-3 text-sm text-indigo-900 sm:grid-cols-3">
            <li className="rounded-lg bg-white p-4"><b>1.</b> <Link className="underline" to="/resumes">Upload your resume</Link> (PDF)</li>
            <li className="rounded-lg bg-white p-4"><b>2.</b> <Link className="underline" to="/analyses">Match it to a job description</Link></li>
            <li className="rounded-lg bg-white p-4"><b>3.</b> <Link className="underline" to="/interviews/new">Take a mock interview</Link></li>
          </ol>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Interviews completed" value={totals.interviews_completed} />
        <StatTile label="Average interview score" value={totals.avg_interview_score ?? "–"} hint="out of 100" />
        <StatTile label="Best job match" value={totals.best_match_score ?? "–"} hint="out of 100" />
        <StatTile label="Job matches run" value={totals.analyses} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold">Score trend</h2>
          <p className="text-sm text-slate-500">Overall score of your last {trend.length || ""} completed interviews</p>
          {trend.length < 2 ? (
            <p className="mt-10 text-center text-sm text-slate-400">Complete at least two interviews to see your trend.</p>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="n" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(n) => `#${n}`} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip
                    formatter={(v) => [`${v}/100`, "Score"]}
                    labelFormatter={(_, p) => (p?.[0] ? `${p[0].payload.role} · ${p[0].payload.date}` : "")}
                  />
                  <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold">Topics to work on</h2>
          <p className="text-sm text-slate-500">Your lowest average scores</p>
          {weakest_topics.length === 0 ? (
            <p className="mt-10 text-center text-sm text-slate-400">Answer some questions to see this.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {weakest_topics.map((t) => (
                <li key={t.topic}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{t.topic}</span>
                    <span className="text-slate-500">{t.avg_score}/10</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${t.avg_score >= 7 ? "bg-green-500" : t.avg_score >= 5 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${t.avg_score * 10}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!fresh && totals.interviews_completed === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No interviews yet"
            body="Run your first mock interview to start tracking your scores."
            action={<Link to="/interviews/new" className="btn-primary">Start now</Link>}
          />
        </div>
      )}
    </>
  );
}
