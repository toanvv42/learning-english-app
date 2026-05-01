import { requireEnv } from "@/lib/env";
import { DEFAULT_GEMINI_MODEL, type GeminiModel } from "./models";

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

type GeminiErrorResponse = {
  error?: {
    message?: string;
    status?: string;
  };
};

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function extractText(response: GeminiResponse) {
  return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

export async function generateGeminiText(
  body: unknown,
  model: GeminiModel = DEFAULT_GEMINI_MODEL,
  apiKey = requireEnv("GEMINI_API_KEY"),
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => null)) as GeminiResponse | GeminiErrorResponse | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : `Gemini request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return extractText(payload as GeminiResponse);
}

export async function validateGeminiApiKey(apiKey: string, model: GeminiModel = DEFAULT_GEMINI_MODEL) {
  const text = await generateGeminiText(
    {
      contents: [
        {
          parts: [{ text: "Reply with only the word OK." }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 4,
      },
    },
    model,
    apiKey,
  );

  if (!text) {
    throw new Error("Gemini API key validation returned an empty response.");
  }
}
