import { probeMetadata } from "../src/server/services/metadata-probe-service";
import { google } from "googleapis";
import { env } from "../src/config/env";

async function main() {
  const oauth2Client = new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri
  );
  oauth2Client.setCredentials({
    refresh_token: env.googleRefreshToken,
  });

  const tokenInfo = await oauth2Client.getAccessToken();
  const accessToken = tokenInfo.token;
  if (!accessToken) {
    throw new Error("Failed to get token");
  }

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const listRes = await drive.files.list({
    q: "trashed = false",
    pageSize: 20
  });

  const files = listRes.data.files || [];
  // Find a video file
  const videoFile = files.find(f => f.mimeType && f.mimeType.startsWith("video/"));
  if (!videoFile || !videoFile.id) {
    console.error("No video file found in Drive search results.");
    return;
  }

  console.log(`Probing file: ${videoFile.name} (ID: ${videoFile.id})`);
  const result = await probeMetadata(videoFile.id, accessToken);
  console.log("Result:", result);
}

main().catch(console.error);
