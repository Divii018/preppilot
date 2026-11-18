import type { ReactNode } from "react";

export function ScoreRing({ value, max = 100, size = 96, label }: { value: number; max?: number; size?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const color = pct >= 0.75 ? "#16a34a" : pct >= 0.55 ? "#d97706" : "#dc2626";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth="8" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold leading-none">{value}</div>
        {label && <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>}
      </div>
    </div>
  );
}

export function Chips({ items, tone = "slate" }: { items: string[]; tone?: "green" | "red" | "slate" | "indigo" }) {
  const tones = {
    green: "bg-green-50 text-green-700 ring-1 ring-green-200",
    red: "bg-red-50 text-red-700 ring-1 ring-red-200",
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  };
  if (items.length === 0) return <p className="text-sm text-slate-400">None</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className={`chip ${tones[tone]}`}>{s}</span>
      ))}
    </div>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-slate-700">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />{s}</li>
      ))}
    </ul>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      {label}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center py-12 text-center">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
