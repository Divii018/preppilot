import { useEffect, useRef, useState } from "react";
import { api, type Resume } from "../api";
import { BulletList, Chips, EmptyState, ErrorBox, PageHeader, Spinner, errMsg, fmtDate } from "../components/ui";

export default function Resumes() {
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listResumes().then((r) => setResumes(r.resumes)).catch((e) => setError(errMsg(e)));
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { resume } = await api.uploadResume(file);
      setResumes((rs) => [resume, ...(rs ?? [])]);
      setOpen(resume.id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this resume and its job matches?")) return;
    try {
      await api.deleteResume(id);
      setResumes((rs) => rs?.filter((r) => r.id !== id) ?? null);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Resumes"
        subtitle="Upload a PDF and the AI turns it into a structured profile used for matching and interviews."
        action={
          <>
            <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button className="btn-primary" disabled={uploading} onClick={() => input.current?.click()}>
              {uploading ? "Reading resume…" : "Upload PDF"}
            </button>
          </>
        }
      />
      <div className="space-y-4">
        <ErrorBox message={error} />
        {uploading && <div className="card"><Spinner label="Reading your resume. This usually takes 10–20 seconds…" /></div>}
        {resumes === null ? (
          <Spinner label="Loading…" />
        ) : resumes.length === 0 ? (
          <EmptyState title="No resumes yet" body="Upload your resume as a PDF (max 5 MB) to get started." />
        ) : (
          resumes.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{r.profile.name || r.filename}</h3>
                  <p className="text-sm text-slate-500">{r.profile.headline}</p>
                  <p className="mt-1 text-xs text-slate-400">{r.filename} · uploaded {fmtDate(r.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    {open === r.id ? "Hide" : "View profile"}
                  </button>
                  <button className="btn-secondary text-red-600" onClick={() => remove(r.id)}>Delete</button>
                </div>
              </div>
              {open === r.id && (
                <div className="mt-6 grid gap-6 border-t border-slate-100 pt-6 md:grid-cols-2">
                  <section className="md:col-span-2">
                    <h4 className="mb-2 text-sm font-semibold text-slate-500">Summary</h4>
                    <p className="text-sm">{r.profile.summary}</p>
                  </section>
                  <section className="md:col-span-2">
                    <h4 className="mb-2 text-sm font-semibold text-slate-500">Skills</h4>
                    <Chips items={r.profile.skills} tone="indigo" />
                  </section>
                  <section>
                    <h4 className="mb-2 text-sm font-semibold text-slate-500">Projects</h4>
                    <div className="space-y-3">
                      {r.profile.projects.map((p) => (
                        <div key={p.name}>
                          <div className="text-sm font-medium">{p.name}</div>
                          <p className="text-sm text-slate-600">{p.description}</p>
                          <p className="text-xs text-slate-400">{p.tech.join(" · ")}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h4 className="mb-2 text-sm font-semibold text-slate-500">Experience</h4>
                    <div className="space-y-3">
                      {r.profile.experience.map((x, i) => (
                        <div key={i}>
                          <div className="text-sm font-medium">{x.title} · {x.organization}</div>
                          <p className="text-xs text-slate-400">{x.duration}</p>
                          <BulletList items={x.highlights} />
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
