import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptGeminiApiKey } from "@/lib/crypto/userGeminiKey";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateGeminiApiKey } from "@/lib/gemini/rest";
import { DEFAULT_GEMINI_MODEL, type GeminiModel } from "@/lib/gemini/models";

const saveKeySchema = z.object({
  apiKey: z.string().trim().min(20, "Gemini API key is too short."),
  model: z.string().optional(),
});

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user, response: null };
}

export async function GET() {
  try {
    const { supabase, user, response } = await getAuthenticatedUser();

    if (response) {
      return response;
    }

    const { data, error } = await supabase
      .from("user_gemini_keys")
      .select("created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      hasKey: Boolean(data),
      updatedAt:
        typeof data === "object" && data !== null && "updated_at" in data && typeof data.updated_at === "string"
          ? data.updated_at
          : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Gemini key status.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, response } = await getAuthenticatedUser();

    if (response) {
      return response;
    }

    const body = saveKeySchema.parse(await request.json());
    const selectedModel = (body.model || DEFAULT_GEMINI_MODEL) as GeminiModel;
    await validateGeminiApiKey(body.apiKey, selectedModel);
    const encrypted = await encryptGeminiApiKey(body.apiKey);

    const { error } = await supabase.from("user_gemini_keys").upsert({
      user_id: user.id,
      encrypted_key: encrypted.encryptedKey,
      iv: encrypted.iv,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ hasKey: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save Gemini API key.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const { supabase, user, response } = await getAuthenticatedUser();

    if (response) {
      return response;
    }

    const { error } = await supabase
      .from("user_gemini_keys")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ hasKey: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove Gemini API key.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
