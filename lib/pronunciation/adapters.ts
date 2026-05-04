import { z } from "zod";
import type { PronunciationAssessment } from "@/types/feedback";

export const assessmentResponseSchema = z.object({
  overall_score: z.number(),
  words: z.array(
    z.object({
      word: z.string(),
      expected_phonemes: z.array(z.string()),
      actual_phonemes: z.array(z.string()),
      score: z.number(),
      errors: z.array(
        z.object({
          position: z.number().int(),
          expected: z.string(),
          actual: z.string().nullable(),
          tip: z.string(),
        }),
      ),
    }),
  ),
  fluency_score: z.number(),
  duration_seconds: z.number(),
  processing_time_ms: z.number(),
});

type AssessmentInput = {
  audioBlob: Blob;
  fileName: string;
  targetSentence: string;
  language: string;
};

type PronunciationProvider = "self-hosted" | "azure";

const azurePhonemeSchema = z.object({
  Phoneme: z.string(),
  AccuracyScore: z.number().optional(),
  NBestPhonemes: z
    .array(
      z.object({
        Phoneme: z.string(),
        Score: z.number().optional(),
      }),
    )
    .optional(),
});

const azureWordSchema = z.object({
  Word: z.string(),
  AccuracyScore: z.number().optional(),
  ErrorType: z.string().optional(),
  Phonemes: z.array(azurePhonemeSchema).optional(),
});

const azureResponseSchema = z.object({
  RecognitionStatus: z.string(),
  Duration: z.number().optional(),
  NBest: z
    .array(
      z.object({
        AccuracyScore: z.number().optional(),
        FluencyScore: z.number().optional(),
        PronScore: z.number().optional(),
        Words: z.array(azureWordSchema).optional(),
      }),
    )
    .optional(),
});

function getProvider(): PronunciationProvider {
  const provider = (process.env.PRONUNCIATION_PROVIDER ?? "self-hosted").toLowerCase();

  if (provider === "azure") {
    return "azure";
  }

  if (provider === "self-hosted" || provider === "self_hosted" || provider === "selfhosted") {
    return "self-hosted";
  }

  throw new Error("PRONUNCIATION_PROVIDER must be either 'self-hosted' or 'azure'.");
}

function getTimeoutMs() {
  const configuredTimeout = Number(process.env.PRONUNCIATION_API_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 15000;
}

function getSelfHostedApiUrl() {
  const baseUrl = process.env.PRONUNCIATION_API_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("Pronunciation assessment is not configured.");
  }

  return `${baseUrl}/assess`;
}

function getSelfHostedHeaders() {
  const apiKey = process.env.PRONUNCIATION_API_KEY;
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
}

function normalizeLanguage(language: string) {
  const [primary, region] = language.split("-");
  return region ? `${primary.toLowerCase()}-${region.toUpperCase()}` : language;
}

function stringToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function getAzureContentType(audioBlob: Blob) {
  const contentType = audioBlob.type.split(";")[0].toLowerCase();

  if (contentType === "audio/wav" || contentType === "audio/wave" || contentType === "audio/x-wav") {
    return "audio/wav; codecs=audio/pcm; samplerate=16000";
  }

  if (contentType === "audio/ogg") {
    return "audio/ogg; codecs=opus";
  }

  throw new Error("Azure pronunciation assessment requires WAV PCM 16 kHz mono or OGG Opus audio.");
}

function buildAzureAssessmentHeader(targetSentence: string) {
  return stringToBase64(
    JSON.stringify({
      ReferenceText: targetSentence,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: "True",
      NBestPhonemeCount: 5,
    }),
  );
}

function makePhonemeTip(expected: string, actual: string | null) {
  if (!actual) {
    return `Make sure the /${expected}/ sound is clearly present.`;
  }

  return `Aim for /${expected}/ instead of /${actual}/. Slow down and shape that sound clearly.`;
}

function mapAzureResponse(response: unknown, processingTimeMs: number): PronunciationAssessment {
  const parsed = azureResponseSchema.parse(response);

  if (parsed.RecognitionStatus !== "Success") {
    throw new Error(`Azure Speech recognition status: ${parsed.RecognitionStatus}.`);
  }

  const best = parsed.NBest?.[0];

  if (!best) {
    throw new Error("Azure Speech returned no pronunciation result.");
  }

  const words = (best.Words ?? [])
    .filter((word) => word.ErrorType !== "Insertion")
    .map((word) => {
      const expectedPhonemes = word.Phonemes?.map((phoneme) => phoneme.Phoneme) ?? [];
      const actualPhonemes =
        word.ErrorType === "Omission"
          ? []
          : word.Phonemes?.map((phoneme) => {
              const bestAlternative = phoneme.NBestPhonemes?.[0]?.Phoneme;
              return phoneme.AccuracyScore !== undefined && phoneme.AccuracyScore < 80 && bestAlternative
                ? bestAlternative
                : phoneme.Phoneme;
            }) ?? [];
      const errors =
        word.ErrorType === "Omission"
          ? expectedPhonemes.map((expected, position) => ({
              position,
              expected,
              actual: null,
              tip: makePhonemeTip(expected, null),
            }))
          : (word.Phonemes ?? [])
              .map((phoneme, position) => {
                const bestAlternative = phoneme.NBestPhonemes?.[0]?.Phoneme;
                const actual =
                  bestAlternative && bestAlternative !== phoneme.Phoneme
                    ? bestAlternative
                    : null;

                if ((phoneme.AccuracyScore ?? 100) >= 80) {
                  return null;
                }

                return {
                  position,
                  expected: phoneme.Phoneme,
                  actual,
                  tip: makePhonemeTip(phoneme.Phoneme, actual),
                };
              })
              .filter((error): error is NonNullable<typeof error> => error !== null);

      return {
        word: word.Word,
        expected_phonemes: expectedPhonemes,
        actual_phonemes: actualPhonemes,
        score: word.AccuracyScore ?? 0,
        errors,
      };
    });

  return assessmentResponseSchema.parse({
    overall_score: best.PronScore ?? best.AccuracyScore ?? 0,
    words,
    fluency_score: best.FluencyScore ?? 0,
    duration_seconds: (parsed.Duration ?? 0) / 10_000_000,
    processing_time_ms: processingTimeMs,
  });
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Pronunciation assessment timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function assessWithSelfHosted(input: AssessmentInput) {
  const formData = new FormData();
  formData.append("audio", input.audioBlob, input.fileName);
  formData.append("target_sentence", input.targetSentence);
  formData.append("language", input.language);

  return withTimeout(async (signal) => {
    const response = await fetch(getSelfHostedApiUrl(), {
      method: "POST",
      headers: getSelfHostedHeaders(),
      body: formData,
      signal,
    });
    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      const message =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : `Pronunciation assessment failed with status ${response.status}.`;
      throw new Error(message);
    }

    return assessmentResponseSchema.parse(body);
  });
}

async function assessWithAzure(input: AssessmentInput) {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    throw new Error("Azure Speech assessment requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.");
  }

  const language = normalizeLanguage(input.language);
  const url = new URL(
    `https://${speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
  );
  url.searchParams.set("language", language);
  url.searchParams.set("format", "detailed");

  const started = Date.now();

  return withTimeout(async (signal) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": getAzureContentType(input.audioBlob),
        "Ocp-Apim-Subscription-Key": speechKey,
        "Pronunciation-Assessment": buildAzureAssessmentHeader(input.targetSentence),
      },
      body: input.audioBlob,
      signal,
    });
    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(`Azure pronunciation assessment failed with status ${response.status}.`);
    }

    return mapAzureResponse(body, Date.now() - started);
  });
}

export async function assessPronunciation(input: AssessmentInput) {
  return getProvider() === "azure" ? assessWithAzure(input) : assessWithSelfHosted(input);
}
