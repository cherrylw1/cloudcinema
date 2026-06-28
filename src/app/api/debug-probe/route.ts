/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import ffprobeStatic from "ffprobe-static";
import { google } from "googleapis";
import { env } from "@/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const listRes = await drive.files.list({
      q: "trashed = false",
      pageSize: 20
    });

    const files = listRes.data.files || [];
    const videoFile = files.find(f => f.mimeType && f.mimeType.startsWith("video/"));

    if (!videoFile || !videoFile.id) {
      return NextResponse.json({ error: "No video file found" });
    }

    const fileId = videoFile.id;
    const ffprobePath = ffprobeStatic.path;

    if (!ffprobePath) {
      return NextResponse.json({ error: "ffprobe-static path is null" });
    }

    const remoteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const args = [
      "-headers", `Authorization: Bearer ${accessToken}\r\n`,
      "-print_format", "json",
      "-show_streams",
      remoteUrl
    ];

    const ffprobeProcess = spawn(ffprobePath, args);

    let stdout = "";
    let stderr = "";

    ffprobeProcess.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    ffprobeProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise((resolve) => {
      ffprobeProcess.on("close", resolve);
    });

    let parsedStdout = null;
    try {
      if (stdout) {
        parsedStdout = JSON.parse(stdout);
      }
    } catch (err: any) {
      parsedStdout = { error: "Failed to parse JSON", raw: stdout, parseError: err.message };
    }

    return NextResponse.json({
      fileName: videoFile.name,
      fileId,
      exitCode,
      stdout: parsedStdout,
      stderr,
      ffprobePath
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
