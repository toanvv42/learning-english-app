import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAudioLimit, MAX_AUDIO_BYTES } from "@/lib/audioLimits";
import { getR2ObjectBlob } from "@/lib/r2/client";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const jsonRequestSchema = z.object({
  objectKey: z.string().min(1),
  targetSentence: z.string().min(1),
  language: z.string().min(1).default("en-us"),
});

const assessmentResponseSchema = z.object({
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

function getPronunciationApiUrl() {
  const baseUrl = process.env.PRONUNCIATION_API_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("Pronunciation assessment is not configured.");
  }

  return `${baseUrl}/assess`;
}

function getTimeoutMs() {
  const configuredTimeout = Number(process.env.PRONUNCIATION_API_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 15000;
}

function getPronunciationApiHeaders() {
  const apiKey = process.env.PRONUNCIATION_API_KEY;
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
}

async function postAssessment(input: {
  audioBlob: Blob;
  fileName: string;
  targetSentence: string;
  language: string;
}) {
  const formData = new FormData();
  formData.append("audio", input.audioBlob, input.fileName);
  formData.append("target_sentence", input.targetSentence);
  formData.append("language", input.language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(getPronunciationApiUrl(), {
      method: "POST",
      headers: getPronunciationApiHeaders(),
      body: formData,
      signal: controller.signal,
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
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Pronunciation assessment timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = await enforceUserRateLimit(supabase, {
      route: "pronunciation-assess",
      limit: 30,
      windowSeconds: 60 * 60,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const contentType = request.headers.get("content-type") ?? "";
    let audioBlob: Blob;
    let fileName = "recording.webm";
    let targetSentence: string;
    let language = "en-us";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const audio = formData.get("audio");
      const target = formData.get("targetSentence");
      const requestedLanguage = formData.get("language");

      if (!(audio instanceof Blob)) {
        return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
      }

      if (typeof target !== "string" || target.trim().length === 0) {
        return NextResponse.json({ error: "Missing target sentence." }, { status: 400 });
      }

      audioBlob = audio;
      fileName = audio instanceof File && audio.name ? audio.name : fileName;
      targetSentence = target.trim();
      language = typeof requestedLanguage === "string" && requestedLanguage.trim()
        ? requestedLanguage.trim()
        : language;
    } else {
      const body = jsonRequestSchema.parse(await request.json());

      if (!body.objectKey.startsWith(`recordings/${user.id}/`)) {
        return NextResponse.json({ error: "Invalid recording object." }, { status: 403 });
      }

      audioBlob = await getR2ObjectBlob(body.objectKey);
      targetSentence = body.targetSentence;
      language = body.language;
    }

    if (audioBlob.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `Audio file is too large. Maximum size is ${formatAudioLimit()}.` },
        { status: 413 },
      );
    }

    const assessment = await postAssessment({
      audioBlob,
      fileName,
      targetSentence,
      language,
    });

    return NextResponse.json({ assessment });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not assess pronunciation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
