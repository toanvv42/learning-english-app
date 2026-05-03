import {
  primaryIssues,
  type AIFeedback,
  type PrimaryIssue,
  type PronunciationAssessment,
} from "@/types/feedback";
import { DEFAULT_GEMINI_MODEL, type GeminiModel } from "@/lib/gemini/models";

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
  };
};

const feedbackPrompt = `You are an English pronunciation coach for a Vietnamese native speaker.

Compare the target English sentence with the Gemini transcript and any pronunciation assessment evidence provided.

First decide whether the learner attempted the target sentence. If the transcript is a completely different sentence or shares very few important words with the target, set:
- overall_score: 1
- primary_issue: "wrong_sentence"
- specific_fix: "Read the target sentence exactly first, then we can check pronunciation."
- vietnamese_tip: explain in Vietnamese that they should read the displayed sentence, not a different sentence
- encouragement: short and calm
Do not give pronunciation feedback for a completely different sentence.

Common Vietnamese-speaker issues to look for:
- Dropped final consonants: /t/, /d/, /s/, /z/, /k/, -ed, -s
- /theta/ substitutions as /t/ or /s/
- /sh/ substitutions as /s/
- /ch/ substitutions as /s/
- Vowel length issues when transcript evidence suggests them
- Simple grammar differences such as missed past tense

When pronunciation assessment evidence is provided, prefer concrete phoneme evidence over transcript guesses. For example, if a word shows expected /θ/ and actual /t/, give the learner the TH fix. Do not mention model internals or confidence.

Focus on exactly one issue: the most useful fix for the learner's next attempt.
Be encouraging but specific.
overall_score must be an integer from 1 to 10, where 10 is excellent.
The vietnamese_tip field must be written in Vietnamese.
Return only the requested JSON object.`;

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

async function callBrowserGemini(apiKey: string, model: GeminiModel, body: unknown) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      referrer: window.location.origin,
      referrerPolicy: "origin",
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

function normalizedWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function isWrongSentence(targetText: string, transcript: string) {
  const targetWords = normalizedWords(targetText);
  const transcriptWords = new Set(normalizedWords(transcript));

  if (targetWords.length === 0 || transcriptWords.size === 0) {
    return false;
  }

  const overlap = targetWords.filter((word) => transcriptWords.has(word)).length;
  return overlap / targetWords.length < 0.35;
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

function summarizeAssessment(assessment: PronunciationAssessment | null | undefined) {
  if (!assessment) {
    return "No pronunciation assessment evidence was available.";
  }

  const issueLines = assessment.words
    .flatMap((word) =>
      word.errors.map((error) => {
        const actual = error.actual ?? "missing";
        return `- ${word.word}: expected /${error.expected}/, heard /${actual}/. Tip: ${error.tip}`;
      }),
    )
    .slice(0, 8);

  const weakWords = assessment.words
    .filter((word) => word.score < 85)
    .slice(0, 6)
    .map(
      (word) =>
        `${word.word} (${Math.round(word.score)}): expected ${word.expected_phonemes.join(" ")}; heard ${word.actual_phonemes.join(" ") || "missing"}`,
    );

  return [
    `Pronunciation API score: ${Math.round(assessment.overall_score)}/100`,
    `Fluency score: ${Math.round(assessment.fluency_score)}/100`,
    issueLines.length > 0 ? `Detected phoneme errors:\n${issueLines.join("\n")}` : "Detected phoneme errors: none",
    weakWords.length > 0 ? `Weak words:\n- ${weakWords.join("\n- ")}` : "Weak words: none",
  ].join("\n");
}

export async function transcribeWithBrowserGemini(
  audioBlob: Blob,
  apiKey: string,
  model: GeminiModel = DEFAULT_GEMINI_MODEL,
) {
  const base64Audio = arrayBufferToBase64(await audioBlob.arrayBuffer());
  const transcript = await callBrowserGemini(apiKey, model, {
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

export async function generateFeedbackWithBrowserGemini(input: {
  apiKey: string;
  targetText: string;
  transcript: string;
  model?: GeminiModel;
  pronunciationAssessment?: PronunciationAssessment | null;
}) {
  if (isWrongSentence(input.targetText, input.transcript)) {
    return {
      overall_score: 1,
      primary_issue: "wrong_sentence",
      what_you_said: input.transcript,
      what_was_expected: input.targetText,
      specific_fix: "Read the target sentence exactly first, then we can check pronunciation.",
      vietnamese_tip:
        "Bạn đang đọc một câu khác với câu hiển thị. Hãy đọc đúng câu mục tiêu trước, rồi ứng dụng sẽ góp ý phát âm.",
      encouragement: "Try again with the sentence on the screen.",
    } satisfies AIFeedback;
  }

  const text = await callBrowserGemini(input.apiKey, input.model || DEFAULT_GEMINI_MODEL, {
    contents: [
      {
        parts: [
          {
            text: `${feedbackPrompt}\n\nTarget sentence: ${input.targetText}\nGemini transcript: ${input.transcript}`,
          },
          {
            text: `\n\nPronunciation assessment evidence:\n${summarizeAssessment(input.pronunciationAssessment)}`,
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

  return normalizeFeedback(
    JSON.parse(stripJsonFences(text)) as Record<string, unknown>,
    input.targetText,
    input.transcript,
  );
}
