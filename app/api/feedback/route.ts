import { NextResponse } from "next/server";
import { z } from "zod";
import { feedbackSchema, generateFeedback } from "@/lib/gemini/feedback";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type GeminiModel } from "@/lib/gemini/models";
import { enforceUserRateLimit } from "@/lib/rateLimit";

const pronunciationAssessmentSchema = z.object({
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

const requestSchema = z.object({
  itemId: z.string().uuid().nullable(),
  targetText: z.string().min(1),
  transcript: z.string().min(1),
  audioUrl: z.string().nullable(),
  feedback: feedbackSchema.nullable().optional(),
  pronunciationAssessment: pronunciationAssessmentSchema.nullable().optional(),
  model: z.string().optional(),
});

function isMissingPronunciationAssessmentColumn(error: { message: string; code?: string }) {
  return (
    error.code === "PGRST204" ||
    error.message.includes("pronunciation_assessment") ||
    error.message.includes("schema cache")
  );
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
      route: "feedback",
      limit: 30,
      windowSeconds: 60 * 60,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = requestSchema.parse(await request.json());
    const feedback =
      body.feedback ??
      (await generateFeedback({
        targetText: body.targetText,
        transcript: body.transcript,
        model: body.model as GeminiModel,
        pronunciationAssessment: body.pronunciationAssessment,
      }));

    const recordingInsert = {
      user_id: user.id,
      item_id: body.itemId,
      audio_url: body.audioUrl,
      transcript: body.transcript,
      target_text: body.targetText,
      ai_feedback: feedback,
    };

    let { data, error } = await supabase
      .from("recordings")
      .insert({
        ...recordingInsert,
        pronunciation_assessment: body.pronunciationAssessment ?? null,
      })
      .select("id")
      .single();

    if (error && isMissingPronunciationAssessmentColumn(error)) {
      const fallback = await supabase
        .from("recordings")
        .insert(recordingInsert)
        .select("id")
        .single();

      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Recording was not created.");
    }

    return NextResponse.json({
      recordingId: data.id as string,
      feedback,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate feedback.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
