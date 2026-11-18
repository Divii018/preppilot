import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MockProvider } from "../src/ai/mock.js";
import { migrate, pool } from "../src/db/index.js";

const app = createApp(new MockProvider());
const PDF = Buffer.from("%PDF-1.4\n% minimal test file\n");
const JD =
  "We are hiring a Graduate Engineer Trainee. Required: Java, SQL, React, REST APIs, Git and Docker. " +
  "Good communication and problem solving skills expected.";

let token = "";
const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await migrate();
  await pool.query("TRUNCATE users CASCADE");
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Test User", email: "Test@Example.com", password: "password123" });
  expect(res.status).toBe(201);
  token = res.body.token;
});

afterAll(async () => {
  await pool.end();
});

describe("auth", () => {
  it("rejects duplicate emails case-insensitively", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Again", email: "test@example.com", password: "password123" });
    expect(res.status).toBe(409);
  });

  it("rejects a wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "test@example.com", password: "nope" });
    expect(res.status).toBe(401);
  });

  it("blocks protected routes without a token", async () => {
    expect((await request(app).get("/api/resumes")).status).toBe(401);
  });
});

describe("resume → analysis → interview flow", () => {
  let resumeId = "";

  it("rejects non-PDF uploads", async () => {
    const res = await request(app)
      .post("/api/resumes")
      .set(auth())
      .attach("file", Buffer.from("hello"), { filename: "resume.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("uploads and parses a resume", async () => {
    const res = await request(app)
      .post("/api/resumes")
      .set(auth())
      .attach("file", PDF, { filename: "resume.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(201);
    expect(res.body.resume.profile.skills).toContain("React");
    resumeId = res.body.resume.id;
  });

  it("analyses the resume against a job description", async () => {
    const res = await request(app)
      .post("/api/analyses")
      .set(auth())
      .send({ resume_id: resumeId, job_title: "Graduate Engineer Trainee", job_description: JD });
    expect(res.status).toBe(201);
    const { result, match_score } = res.body.analysis;
    expect(match_score).toBeGreaterThanOrEqual(0);
    expect(match_score).toBeLessThanOrEqual(100);
    expect(result.matched_skills).toEqual(expect.arrayContaining(["Java", "React"]));
    expect(result.missing_skills).toEqual(expect.arrayContaining(["Docker", "SQL"]));
  });

  it("runs a full interview and produces a report", async () => {
    const start = await request(app).post("/api/interviews").set(auth()).send({
      role: "Graduate Engineer Trainee",
      job_description: JD,
      resume_id: resumeId,
      interview_type: "mixed",
      difficulty: "medium",
      total_questions: 3,
    });
    expect(start.status).toBe(201);
    expect(start.body.turns).toHaveLength(1);
    const id = start.body.interview.id;

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/interviews/${id}/answer`)
        .set(auth())
        .send({ answer: `Answer ${i}: for example I built a project because it saved 30% time, with clear trade-offs.` });
      expect(res.status).toBe(200);
      expect(res.body.evaluation.score).toBeGreaterThan(0);
    }

    const done = await request(app).get(`/api/interviews/${id}`).set(auth());
    expect(done.body.interview.status).toBe("completed");
    expect(done.body.turns).toHaveLength(3);
    expect(done.body.interview.final_report.overall_score).toBeGreaterThan(0);

    const again = await request(app).post(`/api/interviews/${id}/answer`).set(auth()).send({ answer: "late" });
    expect(again.status).toBe(409);
  });

  it("can end an interview early", async () => {
    const start = await request(app).post("/api/interviews").set(auth()).send({
      role: "Software Engineer",
      interview_type: "hr",
      difficulty: "easy",
      total_questions: 5,
    });
    const id = start.body.interview.id;
    expect((await request(app).post(`/api/interviews/${id}/finish`).set(auth())).status).toBe(400);
    await request(app).post(`/api/interviews/${id}/answer`).set(auth()).send({ answer: "I am a recent graduate." });
    const fin = await request(app).post(`/api/interviews/${id}/finish`).set(auth());
    expect(fin.status).toBe(200);
    expect(fin.body.interview.status).toBe("completed");
    expect(fin.body.turns).toHaveLength(1); // the unanswered question is dropped
  });

  it("does not leak other users' data", async () => {
    const other = await request(app)
      .post("/api/auth/register")
      .send({ name: "Other", email: "other@example.com", password: "password123" });
    const res = await request(app).get("/api/interviews").set({ Authorization: `Bearer ${other.body.token}` });
    expect(res.body.interviews).toHaveLength(0);
    const del = await request(app).delete(`/api/resumes/${resumeId}`).set({ Authorization: `Bearer ${other.body.token}` });
    expect(del.status).toBe(404);
  });

  it("returns dashboard stats", async () => {
    const res = await request(app).get("/api/stats").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.totals.interviews_completed).toBe(2);
    expect(res.body.trend).toHaveLength(2);
    expect(res.body.weakest_topics.length).toBeGreaterThan(0);
  });
});
