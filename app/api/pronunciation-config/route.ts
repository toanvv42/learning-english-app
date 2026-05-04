import { NextResponse } from "next/server";
import { getPronunciationProviderConfig } from "@/lib/pronunciation/adapters";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserPlan, isProPlan } from "@/lib/userPlan";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plan = await getUserPlan(supabase, user.id);

    return NextResponse.json({
      ...getPronunciationProviderConfig({ isPro: isProPlan(plan) }),
      userPlan: plan,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load pronunciation configuration.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
