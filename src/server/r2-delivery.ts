import { createHmac } from "node:crypto";
import { env } from "@/config/env";

export function signedR2ObjectUrl(
  mediaId: string,
  key: string,
  kind: "hls" | "media",
) {
  if (!env.mediaCdnBaseUrl || !env.mediaCdnSigningSecret) return null;

  const expires = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const payload = `${mediaId}\n${key}\n${expires}`;
  const signature = createHmac("sha256", env.mediaCdnSigningSecret)
    .update(payload)
    .digest("hex");
  const baseUrl = env.mediaCdnBaseUrl.replace(/\/$/, "");

  return `${baseUrl}/${kind}/${encodeURIComponent(mediaId)}?key=${encodeURIComponent(key)}&exp=${expires}&sig=${signature}`;
}
