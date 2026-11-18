import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { ErrorBox, errMsg } from "../components/ui";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600 to-violet-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-bold">
          <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg ring-2 ring-white/30" /> PrepPilot
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight">Walk into your next interview already prepared.</h2>
          <ul className="mt-8 space-y-3 text-indigo-100">
            <li>✓ See how your resume scores against any job description</li>
            <li>✓ Practise with an AI interviewer that adapts to your answers</li>
            <li>✓ Get rubric-based feedback on every answer and track your progress</li>
          </ul>
        </div>
        <p className="text-sm text-indigo-200">Built for campus placements and early-career interviews.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "login" ? "Log in to continue your prep." : "Start practising in under a minute."}
            </p>
          </div>
          <ErrorBox message={error} />
          {mode === "register" && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              minLength={mode === "register" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
          <p className="text-center text-sm text-slate-500">
            {mode === "login" ? (
              <>New here? <Link className="font-medium text-indigo-600" to="/register">Create an account</Link></>
            ) : (
              <>Already have an account? <Link className="font-medium text-indigo-600" to="/login">Log in</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
