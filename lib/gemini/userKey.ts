import { decryptGeminiApiKey } from "@/lib/crypto/userGeminiKey";

type UserGeminiKeyRow = {
  encrypted_key: string;
  iv: string;
};

type SupabaseKeyClient = {
  from: (table: "user_gemini_keys") => {
    select: (columns: string) => {
      eq: (
        column: "user_id",
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: unknown;
          error: { code?: string; message: string } | null;
        }>;
      };
    };
  };
};

function isUserGeminiKeyRow(value: unknown): value is UserGeminiKeyRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "encrypted_key" in value &&
    typeof value.encrypted_key === "string" &&
    "iv" in value &&
    typeof value.iv === "string"
  );
}

export async function getUserGeminiApiKey(supabase: unknown, userId: string) {
  const client = supabase as SupabaseKeyClient;
  const { data, error } = await client
    .from("user_gemini_keys")
    .select("encrypted_key, iv")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!isUserGeminiKeyRow(data)) {
    return null;
  }

  return decryptGeminiApiKey(data.encrypted_key, data.iv);
}
