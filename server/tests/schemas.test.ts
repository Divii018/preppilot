import { describe, expect, it } from "vitest";
import { EvaluationSchema, TurnResultSchema, normalizeEvaluation, toOutputSchema } from "../src/ai/schemas.js";
import { heuristicScore } from "../src/ai/mock.js";

describe("toOutputSchema", () => {
  it("closes every object so structured outputs accept it", () => {
    const schema = toOutputSchema(TurnResultSchema) as any;
    expect(schema.$schema).toBeUndefined();
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.evaluation.additionalProperties).toBe(false);
    expect(schema.properties.evaluation.properties.rubric.additionalProperties).toBe(false);
  });
});

describe("normalizeEvaluation", () => {
  it("clamps and rounds scores into 0-10", () => {
    const e = EvaluationSchema.parse({
      score: 11.6,
      rubric: { relevance: -2, depth: 7.4, clarity: 7.5, correctness: 10 },
      strengths: [],
      improvements: [],
      model_answer_outline: [],
    });
    const n = normalizeEvaluation(e);
    expect(n.score).toBe(10);
    expect(n.rubric).toEqual({ relevance: 0, depth: 7, clarity: 8, correctness: 10 });
  });
});

describe("heuristicScore (mock provider)", () => {
  it("scores empty answers as 0", () => expect(heuristicScore("   ")).toBe(0));
  it("rewards longer, reasoned, quantified answers", () => {
    const weak = heuristicScore("I don't know much about it.");
    const strong = heuristicScore(
      "A process has its own memory space while threads share memory within a process. For example, in my project I used 4 worker threads " +
        "because the tasks were I/O bound, so that the UI stayed responsive. The trade-off is that shared memory needs locks to avoid race conditions, " +
        "which I handled with a mutex around the shared queue and measured a 40% drop in latency.",
    );
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(10);
  });
});
