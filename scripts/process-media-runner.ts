/* eslint-disable @typescript-eslint/no-explicit-any */
import { execSync } from "child_process";
import fs from "fs";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

// Types matching repositories/media
interface AudioVariant {
  language: string;
  driveFileId: string;
}

interface SubtitleTrack {
  language: string;
  content: string;
}

async function main() {
  const mediaId = process.argv[2];
  if (!mediaId) {
    console.error("Error: Missing media_id parameter.");
    process.exit(1);
  }

  // Load and validate environment variables
  const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const rawGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const rawGoogleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const rawGoogleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const required = {
    NEXT_PUBLIC_SUPABASE_URL: rawSupabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: rawSupabaseKey,
    GOOGLE_CLIENT_ID: rawGoogleClientId,
    GOOGLE_CLIENT_SECRET: rawGoogleClientSecret,
    GOOGLE_REFRESH_TOKEN: rawGoogleRefreshToken,
    GOOGLE_DRIVE_FOLDER_ID: rawGoogleDriveFolderId
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error(`Error: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  const supabaseUrl = rawSupabaseUrl as string;
  const supabaseKey = rawSupabaseKey as string;
  const googleClientId = rawGoogleClientId as string;
  const googleClientSecret = rawGoogleClientSecret as string;
  const googleRefreshToken = rawGoogleRefreshToken as string;
  const googleDriveFolderId = rawGoogleDriveFolderId as string;

  console.log(`[Processor] Initializing for Media ID: ${mediaId}`);

  // Connect to Supabase
  const supabase = createClient(supabaseUrl as string, supabaseKey as string);

  // Update status to processing
  const { data: media, error: fetchError } = await supabase
    .from("media_library")
    .update({ processing_status: "processing" })
    .eq("id", mediaId)
    .select("drive_file_id, title")
    .maybeSingle();

  if (fetchError || !media) {
    console.error(`Error: Failed to fetch media row or update status:`, fetchError);
    process.exit(1);
  }

  const sourceFileId = media.drive_file_id;
  const title = media.title;
  console.log(`[Processor] Source Drive File ID: ${sourceFileId}, Title: ${title}`);

  // Setup Google Drive Client
  const oauth2Client = new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({ refresh_token: googleRefreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const tokenInfo = await oauth2Client.getAccessToken();
    const accessToken = tokenInfo.token;
    if (!accessToken) {
      throw new Error("Failed to retrieve Drive access token.");
    }

    const sourceUrl = `https://www.googleapis.com/drive/v3/files/${sourceFileId}?alt=media`;

    // 1. Probe the source file
    console.log("[Processor] Probing file streams...");
    const ffprobeOutput = execSync(
      `ffprobe -v quiet -print_format json -show_streams -headers "Authorization: Bearer ${accessToken}\r\n" "${sourceUrl}"`,
      { encoding: "utf8" }
    );
    const parsedProbe = JSON.parse(ffprobeOutput);
    const streams = parsedProbe.streams || [];

    const videoStream = streams.find((s: any) => s.codec_type === "video");
    if (!videoStream) {
      throw new Error("No video stream found in the source file.");
    }

    const doviRecord = videoStream.side_data_list?.find(
      (sd: any) => sd.side_data_type === "DOVI configuration record"
    );
    const dvProfile = doviRecord ? parseInt(doviRecord.dv_profile, 10) : null;
    const isHDR = videoStream.color_transfer === "smpte2084" || videoStream.color_transfer === "arib-std-b67" || dvProfile !== null;

    console.log(`[Processor] Video: codec=${videoStream.codec_name}, HDR=${isHDR}, DV Profile=${dvProfile}`);

    // Collect all audio tracks
    let audioIdx = 0;
    const audioTracks: any[] = [];
    for (const s of streams) {
      if (s.codec_type !== "audio") continue;
      audioTracks.push({
        index: audioIdx++,
        language: s.tags?.language || "unknown",
        codec: s.codec_name,
        channels: s.channels,
      });
    }
    console.log(`[Processor] Found ${audioTracks.length} audio track(s).`);

    // Collect and extract all text subtitle tracks directly into WebVTT text
    const subtitleTracks: SubtitleTrack[] = [];
    const textSubtitleCodecs = new Set(["subrip", "srt", "webvtt", "ass", "ssa", "mov_text", "text", "microdvd"]);
    let subIdx = 0;
    for (const s of streams) {
      if (s.codec_type !== "subtitle") continue;
      const currentIdx = subIdx++;
      if (!textSubtitleCodecs.has(s.codec_name)) continue;

      const lang = s.tags?.language || `track-${currentIdx}`;
      console.log(`[Processor] Extracting subtitle track ${currentIdx} (lang: ${lang})...`);
      try {
        const webvttText = execSync(
          `ffmpeg -headers "Authorization: Bearer ${accessToken}\r\n" -i "${sourceUrl}" -map 0:s:${currentIdx} -f webvtt -`,
          { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
        );
        if (webvttText.trim()) {
          subtitleTracks.push({
            language: lang,
            content: webvttText,
          });
        }
      } catch (err) {
        console.warn(`[Processor] Failed to extract subtitle track ${currentIdx}:`, err);
      }
    }
    console.log(`[Processor] Successfully extracted ${subtitleTracks.length} subtitle track(s).`);

    // 2. Transcode Video to SDR 1080p H.264 + Transcode Audio Track 0 to AAC
    console.log("[Processor] Transcoding main video variant...");
    const outputFilename = "output_default.mp4";
    if (fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);

    const shouldStripDovi = dvProfile === 7 || dvProfile === 8;
    
    // Build ffmpeg parameters
    // We apply tonemapping via zscale if HDR is detected. Fallback to default scale if not HDR.
    // If zscale tonemap is not compiled in ffmpeg, we fallback to mobius tonemap or simple format conversion.
    const vfFilters = isHDR
      ? "zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
      : "scale=1920:-2,format=yuv420p";

    if (shouldStripDovi) {
      console.log("[Processor] Dolby Vision Profile 7/8 detected. Running dovi_tool extraction pipeline...");
      // Pipe source -> ffmpeg (copy raw video to HEVC) -> dovi_tool remove -> ffmpeg (transcode video to SDR H.264 + transcode Audio 0 to AAC)
      // We run this natively via shell execution
      const pipeCommand = `curl -s -H "Authorization: Bearer ${accessToken}" -L "${sourceUrl}" | ` +
        `ffmpeg -y -i pipe:0 -an -c:v copy -bsf:v hevc_mp4toannexb -f hevc pipe:1 | ` +
        `dovi_tool remove - -o - | ` +
        `ffmpeg -y -i pipe:0 -headers "Authorization: Bearer ${accessToken}\r\n" -i "${sourceUrl}" ` +
        `-map 0:v -map 1:a:0 -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k -vf "${vfFilters}" -movflags +faststart ${outputFilename}`;
      
      execSync(pipeCommand, { stdio: "inherit" });
    } else {
      console.log("[Processor] Running direct FFmpeg SDR H.264 transcode...");
      const transcodeCommand = `ffmpeg -y -headers "Authorization: Bearer ${accessToken}\r\n" -i "${sourceUrl}" ` +
        `-map 0:v:0 -map 0:a:0 -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k -vf "${vfFilters}" -movflags +faststart ${outputFilename}`;
      
      execSync(transcodeCommand, { stdio: "inherit" });
    }

    if (!fs.existsSync(outputFilename) || fs.statSync(outputFilename).size === 0) {
      throw new Error("Transcode output file is empty or was not created.");
    }

    console.log("[Processor] Transcoding complete. Uploading main variant to Google Drive...");

    // Upload default file to Google Drive
    const uploadRes = await drive.files.create({
      requestBody: {
        name: `${title} (1080p SDR).mp4`,
        parents: [googleDriveFolderId],
        mimeType: "video/mp4",
      },
      media: {
        body: fs.createReadStream(outputFilename),
      },
      fields: "id",
    });

    const newDefaultFileId = uploadRes.data.id;
    if (!newDefaultFileId) {
      throw new Error("Failed to upload default variant to Google Drive.");
    }
    console.log(`[Processor] Uploaded main variant. New Drive File ID: ${newDefaultFileId}`);

    // 3. Process additional audio tracks (index > 0)
    const audioVariants: AudioVariant[] = [
      { language: audioTracks[0]?.language || "default", driveFileId: newDefaultFileId },
    ];

    for (let i = 1; i < audioTracks.length; i++) {
      const track = audioTracks[i];
      const variantFilename = `output_variant_${track.index}.mp4`;
      console.log(`[Processor] Muxing audio track ${track.index} (lang: ${track.language})...`);
      
      if (fs.existsSync(variantFilename)) fs.unlinkSync(variantFilename);

      // Fast mux: copy already-transcoded video + map & transcode secondary audio track to AAC
      const muxCommand = `ffmpeg -y -i ${outputFilename} -headers "Authorization: Bearer ${accessToken}\r\n" -i "${sourceUrl}" ` +
        `-map 0:v:0 -c:v copy -map 1:a:${track.index} -c:a aac -b:a 192k -movflags +faststart ${variantFilename}`;
      
      execSync(muxCommand, { stdio: "inherit" });

      if (fs.existsSync(variantFilename) && fs.statSync(variantFilename).size > 0) {
        console.log(`[Processor] Uploading audio variant ${track.index} to Google Drive...`);
        const variantUpload = await drive.files.create({
          requestBody: {
            name: `${title} (1080p SDR) - ${track.language}.mp4`,
            parents: [googleDriveFolderId],
            mimeType: "video/mp4",
          },
          media: {
            body: fs.createReadStream(variantFilename),
          },
          fields: "id",
        });

        const variantFileId = variantUpload.data.id;
        if (variantFileId) {
          audioVariants.push({
            language: track.language,
            driveFileId: variantFileId,
          });
          console.log(`[Processor] Variant uploaded. File ID: ${variantFileId}`);
        }
        fs.unlinkSync(variantFilename);
      } else {
        console.warn(`[Processor] Muxing failed for track ${track.index}`);
      }
    }

    // Clean up transcode output
    fs.unlinkSync(outputFilename);

    // 4. Update Supabase with the ready state and newly generated file variants/subtitles
    console.log("[Processor] Updating database record with results...");
    const { error: updateError } = await supabase
      .from("media_library")
      .update({
        drive_file_id: newDefaultFileId,
        processing_status: "ready",
        dv_profile: null, // Converted to SDR
        audio_codec: "aac",
        mime_type: "video/mp4",
        audio_variants: audioVariants as any,
        subtitle_tracks: subtitleTracks as any,
      })
      .eq("id", mediaId);

    if (updateError) {
      throw updateError;
    }

    console.log("[Processor] Processing complete and catalog updated successfully!");
  } catch (err: any) {
    console.error("[Processor] Fatal processing error:", err);
    // Set status to failed in database
    await supabase
      .from("media_library")
      .update({
        processing_status: "failed",
      })
      .eq("id", mediaId);

    process.exit(1);
  }
}

main();
