import { DEFAULT_GEMINI_MODEL, type GeminiModel } from "./models";
import { arrayBufferToBase64, generateGeminiText } from "./rest";

export async function transcribeAudioBlob(
  audioBlob: Blob,
  model: GeminiModel = DEFAULT_GEMINI_MODEL,
  apiKey?: string | null,
): Promise<string> {
  const base64Audio = arrayBufferToBase64(await audioBlob.arrayBuffer());
  const transcript = await generateGeminiText({
    contents: [
      {
        parts: [
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
      },
    ],
    generationConfig: {
      temperature: 0,
    },
  }, model, apiKey || undefined);

  if (!transcript) {
    throw new Error("Gemini returned an empty transcript.");
  }

  return transcript;
}
