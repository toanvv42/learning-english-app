export const GEMINI_MODELS = [
  { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
  { label: "Gemini 2.5 Flash-Lite", value: "gemini-2.5-flash-lite" },
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number]["value"];

export const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-2.5-flash";
