import { NextResponse } from "next/server";
import { z } from "zod";
import { feedbackSchema, generateFeedback } from "@/lib/gemini/feedback";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type GeminiModel } from "@/lib/gemini/models";

const requestSchema = z.object({
  itemId: z.string().uuid().nullable(),
  targetText: z.string().min(1),
  transcript: z.string().min(1),
  audioUrl: z.string().nullable(),
  feedback: feedbackSchema.nullable().optional(),
  model: z.string().optional(),
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

    const body = requestSchema.parse(await request.json());
    const feedback =
      body.feedback ??
      (await generateFeedback({
        targetText: body.targetText,
        transcript: body.transcript,
        model: body.model as GeminiModel,
      }));

    const { data, error } = await supabase
      .from("recordings")
      .insert({
        user_id: user.id,
        item_id: body.itemId,
        audio_url: body.audioUrl,
        transcript: body.transcript,
        target_text: body.targetText,
        ai_feedback: feedback,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
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
