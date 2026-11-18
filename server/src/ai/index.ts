import { config } from "../config.js";
import { ClaudeProvider } from "./claude.js";
import { MockProvider } from "./mock.js";
import type { AIProvider } from "./provider.js";

export function createProvider(): AIProvider {
  if (config.AI_MOCK || config.NODE_ENV === "test") return new MockProvider();
  return new ClaudeProvider();
}

export type { AIProvider } from "./provider.js";
export { AIError } from "./provider.js";
