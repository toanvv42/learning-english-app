import type { SupabaseClient } from "@supabase/supabase-js";

export type UserPlan = "free" | "pro";

export function isProPlan(plan: UserPlan) {
  return plan === "pro";
}

export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<UserPlan> {
  const { error: insertError } = await supabase
    .from("user_profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (insertError) {
    throw new Error(`Could not initialize user profile: ${insertError.message}`);
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error(`Could not load user plan: ${error.message}`);
  }

  return data?.plan === "pro" ? "pro" : "free";
}
