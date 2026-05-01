import { NextResponse } from "next/server";
import { z } from "zod";
import { getR2ObjectBlob } from "@/lib/r2/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { transcribeAudioBlob } from "@/lib/gemini/transcribe";

const requestSchema = z.object({
  objectKey: z.string().min(1),
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

    const contentType = request.headers.get("content-type") ?? "";
    let audioBlob: Blob;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const audio = formData.get("audio");

      if (!(audio instanceof Blob)) {
        return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
      }

      audioBlob = audio;
    } else {
      const { objectKey } = requestSchema.parse(await request.json());

      if (!objectKey.startsWith(`recordings/${user.id}/`)) {
        return NextResponse.json({ error: "Invalid recording object." }, { status: 403 });
      }

      audioBlob = await getR2ObjectBlob(objectKey);
    }

    const transcript = await transcribeAudioBlob(audioBlob);

    return NextResponse.json({ transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not transcribe audio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
