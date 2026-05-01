import { primaryIssues, type AIFeedback, type PrimaryIssue } from "@/types/feedback";

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

const feedbackPrompt = `You are an English pronunciation coach for a Vietnamese native speaker.

Compare the target English sentence with the transcript. Give feedback based only on likely evidence in the transcript.

If the learner read a completely different sentence, set overall_score to 1, primary_issue to "wrong_sentence", and tell them to read the target sentence exactly first.

Common Vietnamese-speaker issues:
- Dropped final consonants: /t/, /d/, /s/, /z/, /k/, -ed, -s
- /theta/ substitutions as /t/ or /s/
- /sh/ substitutions as /s/
- /ch/ substitutions as /s/
- Vowel length issues when transcript evidence suggests them
- Simple grammar differences such as missed past tense

Focus on exactly one issue. overall_score must be an integer from 1 to 10. vietnamese_tip must be written in Vietnamese.
Return only a JSON object with these keys: overall_score, primary_issue, what_you_said, what_was_expected, specific_fix, vietnamese_tip, encouragement.`;

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

function stripJsonFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractText(response: GeminiResponse) {
  return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

async function callGemini(apiKey: string, body: unknown) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => null)) as GeminiResponse | { error?: { message?: string } } | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : "Gemini request failed.";
    throw new Error(message);
  }

  return extractText(payload as GeminiResponse);
}

export async function transcribeWithBrowserGemini(audioBlob: Blob, apiKey: string) {
  const base64Audio = arrayBufferToBase64(await audioBlob.arrayBuffer());
  const transcript = await callGemini(apiKey, {
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
  });

  if (!transcript) {
    throw new Error("Gemini returned an empty transcript.");
  }

  return transcript;
}

function normalizeFeedback(value: Record<string, unknown>, targetText: string, transcript: string): AIFeedback {
  const primaryIssue = String(value.primary_issue ?? "other");
  const safePrimaryIssue: PrimaryIssue = primaryIssues.includes(primaryIssue as PrimaryIssue)
    ? (primaryIssue as PrimaryIssue)
    : "other";
  const score = Number(value.overall_score);

  return {
    overall_score: Number.isFinite(score) ? Math.min(10, Math.max(1, Math.round(score))) : 1,
    primary_issue: safePrimaryIssue,
    what_you_said: String(value.what_you_said || transcript),
    what_was_expected: String(value.what_was_expected || targetText),
    specific_fix: String(value.specific_fix || "Try the sentence again, focusing on the final sound."),
    vietnamese_tip: String(value.vietnamese_tip || "Hãy đọc chậm hơn và chú ý âm cuối của từng từ."),
    encouragement: String(value.encouragement || "Try one more time."),
  };
}

export async function generateFeedbackWithBrowserGemini(input: {
  apiKey: string;
  targetText: string;
  transcript: string;
}) {
  const text = await callGemini(input.apiKey, {
    contents: [
      {
        parts: [
          {
            text: `${feedbackPrompt}\n\nTarget sentence: ${input.targetText}\nTranscript: ${input.transcript}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  if (!text) {
    throw new Error("Gemini did not return feedback text.");
  }

  const parsed = JSON.parse(stripJsonFences(text)) as Record<string, unknown>;
  return normalizeFeedback(parsed, input.targetText, input.transcript);
}
