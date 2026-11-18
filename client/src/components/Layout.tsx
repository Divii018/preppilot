import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/resumes", label: "Resumes" },
  { to: "/analyses", label: "Job Match" },
  { to: "/interviews", label: "Mock Interviews" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((h) => setDemo(h.ai === "mock")).catch(() => {});
  }, []);
  return (
    <div className="min-h-screen">
      {demo && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">
          Demo mode: AI responses are sample data, not a real analysis of your resume.
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-bold">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            PrepPilot
          </NavLink>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{user?.name}</span>
            <button onClick={logout} className="btn-secondary py-1.5">Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
