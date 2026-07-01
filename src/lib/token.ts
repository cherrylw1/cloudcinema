import crypto from "crypto";
import { env } from "@/config/env";

/**
 * Generates a secure token for streaming a specific media file by user ID.
 * Uses the Supabase Service Role Key as the server-side signing secret.
 */
export function generateStreamToken(mediaId: string, userId: string): string {
  const secret = env.supabaseServiceRoleKey || "fallback-secret-key-12345";
  return crypto
    .createHmac("sha256", secret)
    .update(`${mediaId}:${userId}`)
    .digest("hex");
}

/**
 * Verifies if the provided token matches the expected signature.
 */
export function verifyStreamToken(mediaId: string, userId: string, token: string): boolean {
  try {
    const expected = generateStreamToken(mediaId, userId);
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
