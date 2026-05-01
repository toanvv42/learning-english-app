import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createR2Client, getR2PublicUrl } from "@/lib/r2/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";

const requestSchema = z.object({
  contentType: z.literal("audio/webm"),
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
    const objectKey = `recordings/${user.id}/${Date.now()}.webm`;
    const command = new PutObjectCommand({
      Bucket: requireEnv("R2_BUCKET_NAME"),
      Key: objectKey,
      ContentType: body.contentType,
    });

    const uploadUrl = await getSignedUrl(createR2Client(), command, {
      expiresIn: 60,
    });

    return NextResponse.json({
      uploadUrl,
      audioUrl: getR2PublicUrl(objectKey),
      objectKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create upload URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
