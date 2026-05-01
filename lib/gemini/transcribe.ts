import { GoogleGenAI } from "@google/genai";
import { requireEnv } from "@/lib/env";
import { DEFAULT_GEMINI_MODEL, type GeminiModel } from "./models";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function transcribeAudioBlob(audioBlob: Blob, model: GeminiModel = DEFAULT_GEMINI_MODEL): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey: requireEnv("GEMINI_API_KEY"),
  });

  const base64Audio = arrayBufferToBase64(await audioBlob.arrayBuffer());
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        text: "Generate only a plain English transcript of the speech in this audio. Do not add commentary, labels, timestamps, or punctuation explanations.",
      },
      {
        inlineData: {
          mimeType: audioBlob.type || "audio/webm",
          data: base64Audio,
        },
      },
    ],
    config: {
      temperature: 0,
    },
  });

  const transcript = response.text?.trim() ?? "";

  if (!transcript) {
    throw new Error("Gemini returned an empty transcript.");
  }

  return transcript;
}
