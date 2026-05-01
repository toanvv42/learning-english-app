import { requireEnv } from "@/lib/env";

type EncryptedGeminiKey = {
  encryptedKey: string;
  iv: string;
};

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 8192;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function getEncryptionKey() {
  const secretBytes = new TextEncoder().encode(requireEnv("USER_KEY_ENCRYPTION_SECRET"));
  const keyBytes = await crypto.subtle.digest("SHA-256", secretBytes);

  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptGeminiApiKey(apiKey: string): Promise<EncryptedGeminiKey> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await getEncryptionKey(),
    new TextEncoder().encode(apiKey),
  );

  return {
    encryptedKey: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptGeminiApiKey(encryptedKey: string, iv: string) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    await getEncryptionKey(),
    base64ToBytes(encryptedKey),
  );

  return new TextDecoder().decode(decrypted);
}
