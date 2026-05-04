import type { SupabaseClient } from "@supabase/supabase-js";

export type UserPlan = "free" | "pro";

export function isProPlan(plan: UserPlan) {
  return plan === "pro";
}

export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<UserPlan> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load user plan: ${error.message}`);
  }

  if (data?.plan) {
    return data.plan === "pro" ? "pro" : "free";
  }

  const { error: insertError } = await supabase
    .from("user_profiles")
    .insert({ user_id: userId, plan: "free" });

  if (insertError) {
    throw new Error(`Could not initialize user profile: ${insertError.message}`);
  }

  return "free";
}
