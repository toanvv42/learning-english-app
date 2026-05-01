import { NextResponse } from "next/server";
import { z } from "zod";
import { getR2ObjectBlob } from "@/lib/r2/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { transcribeAudioBlob } from "@/lib/gemini/transcribe";
import { type GeminiModel } from "@/lib/gemini/models";
import { formatAudioLimit, MAX_AUDIO_BYTES } from "@/lib/audioLimits";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import { getUserGeminiApiKey } from "@/lib/gemini/userKey";

const requestSchema = z.object({
  objectKey: z.string().min(1),
  model: z.string().nullable().optional(),
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
      route: "transcribe",
      limit: 30,
      windowSeconds: 60 * 60,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const contentType = request.headers.get("content-type") ?? "";
    let audioBlob: Blob;
    let selectedModel: GeminiModel | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const audio = formData.get("audio");
      selectedModel = (formData.get("model") as GeminiModel) || undefined;

      if (!(audio instanceof Blob)) {
        return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
      }

      audioBlob = audio;
    } else {
      const { objectKey, model } = requestSchema.parse(await request.json());
      selectedModel = model as GeminiModel;

      if (!objectKey.startsWith(`recordings/${user.id}/`)) {
        return NextResponse.json({ error: "Invalid recording object." }, { status: 403 });
      }

      audioBlob = await getR2ObjectBlob(objectKey);
    }

    if (audioBlob.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `Audio file is too large. Maximum size is ${formatAudioLimit()}.` },
        { status: 413 },
      );
    }

    const userGeminiApiKey = await getUserGeminiApiKey(supabase, user.id);
    const transcript = await transcribeAudioBlob(audioBlob, selectedModel, userGeminiApiKey);

    return NextResponse.json({ transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not transcribe audio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
