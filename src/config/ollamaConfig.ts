const runtimeEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

export const DEFAULT_MODEL = runtimeEnv.OLLAMA_MODEL || "jpacifico/chocolatine-2.1:q4_k_m";
export const OLLAMA_URL = (runtimeEnv.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/+$/u, "");
