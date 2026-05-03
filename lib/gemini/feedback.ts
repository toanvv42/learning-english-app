import { z } from "zod";
import { primaryIssues, type AIFeedback, type PronunciationAssessment } from "@/types/feedback";
import { DEFAULT_GEMINI_MODEL, type GeminiModel } from "./models";
import { generateGeminiText } from "./rest";

export const feedbackSchema = z.object({
  overall_score: z.number().int().min(1).max(10),
  primary_issue: z.enum(primaryIssues),
  what_you_said: z.string().min(1),
  what_was_expected: z.string().min(1),
  specific_fix: z.string().min(1),
  vietnamese_tip: z.string().min(1),
  encouragement: z.string().min(1),
});

const systemPrompt = `You are an English pronunciation coach for a Vietnamese native speaker.

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

function stripJsonFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
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

export async function generateFeedback(input: {
  targetText: string;
  transcript: string;
  model?: GeminiModel;
  apiKey?: string | null;
  pronunciationAssessment?: PronunciationAssessment | null;
}): Promise<AIFeedback> {
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
    };
  }

  const text = await generateGeminiText({
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\nTarget sentence: ${input.targetText}\nGemini transcript: ${input.transcript}`,
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
  }, input.model || DEFAULT_GEMINI_MODEL, input.apiKey || undefined);

  if (!text) {
    throw new Error("Gemini did not return feedback text.");
  }

  const parsed = JSON.parse(stripJsonFences(text)) as unknown;

  if (typeof parsed === "object" && parsed !== null && "overall_score" in parsed) {
    const feedback = parsed as Record<string, unknown>;
    const score = Number(feedback.overall_score);

    if (Number.isFinite(score)) {
      feedback.overall_score = Math.min(10, Math.max(1, Math.round(score)));
    }
  }

  return feedbackSchema.parse(parsed);
}
