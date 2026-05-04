import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAudioLimit, MAX_AUDIO_BYTES } from "@/lib/audioLimits";
import { assessPronunciation } from "@/lib/pronunciation/adapters";
import { getR2ObjectBlob } from "@/lib/r2/client";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const jsonRequestSchema = z.object({
  objectKey: z.string().min(1),
  targetSentence: z.string().min(1),
  language: z.string().min(1).default("en-us"),
});

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

    const assessment = await assessPronunciation({
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
