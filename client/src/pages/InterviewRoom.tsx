import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Interview, type Turn } from "../api";
import { BulletList, Chips, ErrorBox, ScoreRing, Spinner, errMsg } from "../components/ui";
import { speak, stopSpeaking, useDictation } from "../useSpeech";

const SIGNAL: Record<string, { label: string; cls: string }> = {
  strong_yes: { label: "Strong hire", cls: "bg-green-100 text-green-800" },
  yes: { label: "Hire", cls: "bg-green-50 text-green-700" },
  lean_yes: { label: "Leaning hire", cls: "bg-amber-50 text-amber-700" },
  lean_no: { label: "Leaning no hire", cls: "bg-orange-50 text-orange-700" },
  no: { label: "Not yet ready", cls: "bg-red-50 text-red-700" },
};

function Feedback({ turn }: { turn: Turn }) {
  const e = turn.evaluation;
  if (!e) return null;
  const rubric: [string, number][] = [
    ["Relevance", e.rubric.relevance],
    ["Depth", e.rubric.depth],
    ["Clarity", e.rubric.clarity],
    ["Correctness", e.rubric.correctness],
  ];
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-6">
        <ScoreRing value={e.score} max={10} size={72} label="score" />
        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {rubric.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-xs text-slate-500"><span>{k}</span><span>{v}/10</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${v * 10}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div><h5 className="mb-1 text-xs font-semibold uppercase text-green-700">What went well</h5><BulletList items={e.strengths} /></div>
        <div><h5 className="mb-1 text-xs font-semibold uppercase text-amber-700">Improve</h5><BulletList items={e.improvements} /></div>
        <div><h5 className="mb-1 text-xs font-semibold uppercase text-indigo-700">A strong answer covers</h5><BulletList items={e.model_answer_outline} /></div>
      </div>
    </div>
  );
}

export default function InterviewRoom() {
  const { id } = useParams();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<null | "answer" | "finish">(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const dictation = useDictation((text) => setAnswer((a) => (a ? `${a} ${text}` : text)));

  useEffect(() => {
    if (!id) return;
    api.getInterview(id).then((r) => { setInterview(r.interview); setTurns(r.turns); }).catch((e) => setError(errMsg(e)));
    return stopSpeaking;
  }, [id]);

  const current = turns.find((t) => t.answer === null);

  // Read each new question aloud when voice mode is on.
  useEffect(() => {
    if (voiceOn && current) speak(current.question);
  }, [voiceOn, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, interview?.status]);

  async function submit() {
    if (!id || !answer.trim()) return;
    dictation.stop();
    setBusy("answer");
    setError(null);
    try {
      const r = await api.answer(id, answer.trim());
      setInterview(r.interview);
      setTurns(r.turns);
      setAnswer("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    if (!id || !confirm("End the interview now and get your report?")) return;
    setBusy("finish");
    setError(null);
    try {
      const r = await api.finish(id);
      setInterview(r.interview);
      setTurns(r.turns);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  if (!interview) return error ? <ErrorBox message={error} /> : <Spinner label="Loading interview…" />;
  const report = interview.final_report;
  const answeredCount = turns.filter((t) => t.answer !== null).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{interview.role}</h1>
          <p className="text-sm capitalize text-slate-500">{interview.interview_type} · {interview.difficulty}</p>
        </div>
        {interview.status === "in_progress" && (
          <div className="flex items-center gap-2">
            <button className={`btn-secondary ${voiceOn ? "border-indigo-500 text-indigo-700" : ""}`} onClick={() => { if (voiceOn) stopSpeaking(); setVoiceOn(!voiceOn); }}>
              {voiceOn ? "🔊 Voice on" : "🔈 Voice off"}
            </button>
            <button className="btn-secondary" disabled={!!busy || answeredCount === 0} onClick={finish}>End early</button>
          </div>
        )}
      </div>

      <div className="mb-6 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${(answeredCount / interview.total_questions) * 100}%` }} />
      </div>

      {report && (
        <div className="card mb-8 border-indigo-200">
          <div className="flex flex-wrap items-center gap-6">
            <ScoreRing value={report.overall_score} size={120} label="overall" />
            <div className="flex-1">
              <span className={`chip ${SIGNAL[report.hire_signal].cls}`}>{SIGNAL[report.hire_signal].label}</span>
              <p className="mt-2 text-sm text-slate-700">{report.summary}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div><h3 className="mb-2 font-semibold">Top strengths</h3><BulletList items={report.top_strengths} /></div>
            <div><h3 className="mb-2 font-semibold">Focus areas</h3><Chips items={report.focus_areas} tone="red" /></div>
          </div>
          <h3 className="mb-2 mt-6 font-semibold">What to study next</h3>
          <ul className="space-y-2">
            {report.recommended_topics.map((t) => (
              <li key={t.topic} className="rounded-lg bg-slate-50 p-3 text-sm"><b>{t.topic}</b>: {t.why}</li>
            ))}
          </ul>
          <div className="mt-6 flex gap-2">
            <Link to="/interviews/new" className="btn-primary">Practise again</Link>
            <Link to="/" className="btn-secondary">Dashboard</Link>
          </div>
        </div>
      )}

      <ol className="space-y-6">
        {turns.map((t) => (
          <li key={t.id} className="card">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-indigo-600">Q{t.idx + 1} of {interview.total_questions}</span>
              <span className="chip bg-slate-100 capitalize">{t.question_type.replace("_", " ")}</span>
              <span>{t.topic}</span>
            </div>
            <p className="mt-2 font-medium">{t.question}</p>

            {t.answer !== null ? (
              <>
                <p className="mt-3 whitespace-pre-wrap rounded-lg border-l-4 border-indigo-200 bg-white pl-3 text-sm text-slate-700">{t.answer}</p>
                <Feedback turn={t} />
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <textarea
                  className="input min-h-36"
                  placeholder="Type your answer, or use the mic to speak it…"
                  value={answer + (dictation.interim ? ` ${dictation.interim}` : "")}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
                  disabled={!!busy || dictation.listening}
                />
                {dictation.error && <ErrorBox message={dictation.error} />}
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-primary" onClick={submit} disabled={!!busy || !answer.trim()}>
                    {busy === "answer" ? "Evaluating…" : "Submit answer"}
                  </button>
                  {dictation.supported && (
                    <button className={`btn-secondary ${dictation.listening ? "border-red-400 text-red-600" : ""}`} onClick={dictation.listening ? dictation.stop : dictation.start} disabled={!!busy}>
                      {dictation.listening ? "⏹ Stop recording" : "🎙 Speak answer"}
                    </button>
                  )}
                  <span className="text-xs text-slate-400">Ctrl + Enter to submit</span>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {busy && <div className="mt-6"><Spinner label={busy === "finish" ? "Writing your report…" : "Your interviewer is reviewing the answer…"} /></div>}
      <ErrorBox message={error} />
      {interview.status === "in_progress" && !current && !busy && <Spinner label="Preparing next question…" />}
      <div ref={bottom} />
    </div>
  );
}
