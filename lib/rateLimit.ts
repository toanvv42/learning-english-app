import { NextResponse } from "next/server";

type RateLimitRpcClient = {
  rpc: (
    functionName: "check_user_rate_limit",
    args: {
      p_route: string;
      p_limit: number;
      p_window_seconds: number;
    },
  ) => PromiseLike<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
};

type RateLimitOptions = {
  route: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  reset_at: string;
};

function isRateLimitRow(value: unknown): value is RateLimitRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "allowed" in value &&
    typeof value.allowed === "boolean" &&
    "remaining" in value &&
    typeof value.remaining === "number" &&
    "reset_at" in value &&
    typeof value.reset_at === "string"
  );
}

export async function enforceUserRateLimit(
  supabase: unknown,
  { route, limit, windowSeconds }: RateLimitOptions,
) {
  const rateLimitClient = supabase as RateLimitRpcClient;
  const { data, error } = await rateLimitClient.rpc("check_user_rate_limit", {
    p_route: route,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (
    error?.code === "PGRST202" ||
    error?.message.includes("Could not find the function public.check_user_rate_limit")
  ) {
    return NextResponse.json(
      {
        error:
          "Rate limiting is not set up in Supabase yet. Run seed/rate-limit.sql in the Supabase SQL editor, then retry.",
      },
      { status: 503 },
    );
  }

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!isRateLimitRow(row)) {
    throw new Error("Rate limit check returned an invalid response.");
  }

  if (row.allowed) {
    return null;
  }

  const resetAt = new Date(row.reset_at);
  const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

  return NextResponse.json(
    { error: `Too many requests. Try again in ${retryAfter} seconds.` },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(row.remaining),
        "X-RateLimit-Reset": row.reset_at,
      },
    },
  );
}
