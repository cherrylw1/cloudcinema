/* eslint-disable @typescript-eslint/no-explicit-any */
import { execSync, execFileSync } from "child_process";
import fs from "fs";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { packageBrowserHls } from "./hls-packager";

interface AudioVariant {
  language: string;
  driveFileId: string;
}

interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  forced: boolean;
  content: string;
}

const shardIndex = process.env.SHARD_INDEX || "1";

async function main() {
  const mediaId = process.argv[2] || "batch";

  // Load and validate environment variables
  const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const rawGoogleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const rawGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const rawGoogleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  const rawGoogleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

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
    console.error(`[Shard ${shardIndex}] Error: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  const supabaseUrl = rawSupabaseUrl as string;
  const supabaseKey = rawSupabaseKey as string;
  const googleClientId = rawGoogleClientId as string;
  const googleClientSecret = rawGoogleClientSecret as string;
  const googleRefreshToken = rawGoogleRefreshToken as string;
  const googleDriveFolderId = rawGoogleDriveFolderId as string;

  console.log(`[Shard ${shardIndex}] Initializing media processor. Mode: ${mediaId === "batch" ? "Batch Queue" : `Single File (${mediaId})`}`);

  // Connect to Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

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

    if (mediaId === "batch") {
      // --- BATCH MODE ---
      console.log(`[Shard ${shardIndex}] Running in batch mode...`);
      while (true) {
        // Fetch pool of pending items
        const { data: pendingItems, error: fetchError } = await supabase
          .from("media_library")
          .select("*")
          .eq("processing_status", "queued")
          .order("created_at", { ascending: true })
          .limit(10);

        if (fetchError || !pendingItems || pendingItems.length === 0) {
          console.log(`[Shard ${shardIndex}] No more pending media items found.`);
          break;
        }

        // Compare-and-swap claim check
        let claimedItem = null;
        for (const item of pendingItems) {
          const { data, error } = await supabase
            .from("media_library")
            .update({ processing_status: "processing" })
            .eq("id", item.id)
            .eq("processing_status", "queued")
            .select("*")
            .maybeSingle();

          if (!error && data) {
            claimedItem = data;
            break; // Successfully claimed row!
          }
        }

        if (!claimedItem) {
          console.log(`[Shard ${shardIndex}] Failed to claim any items in pool (already claimed by other workers). Retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        console.log(`[Shard ${shardIndex}] Claimed Media ID: ${claimedItem.id}, Title: ${claimedItem.title}`);
        try {
          await processClaimedMedia(
            claimedItem,
            supabase,
            drive,
            accessToken,
            googleDriveFolderId,
          );
        } catch (err) {
          console.error(`[Shard ${shardIndex}] Error processing claimed item ${claimedItem.id}:`, err);
          await setBrowserPreparationState(supabase, claimedItem, "failed");
        }
      }
    } else {
      // --- SINGLE MODE ---
      // An explicit trusted workflow request also recovers legacy/stale states.
      // Per-media workflow concurrency prevents two single runs racing.
      const { data: claimedItem, error: claimError } = await supabase
        .from("media_library")
        .update({ processing_status: "processing" })
        .eq("id", mediaId)
        .select("*")
        .maybeSingle();

      if (claimError || !claimedItem) {
        console.log(`[Shard ${shardIndex}] Media ID ${mediaId} was not found. Exiting.`);
        process.exit(0);
      }

      console.log(`[Shard ${shardIndex}] Processing single claimed Media: ${claimedItem.title}`);
      try {
        await processClaimedMedia(
          claimedItem,
          supabase,
          drive,
          accessToken,
          googleDriveFolderId,
        );
      } catch (error) {
        await setBrowserPreparationState(supabase, claimedItem, "failed");
        throw error;
      }
    }
    
    console.log(`[Shard ${shardIndex}] Worker execution completed.`);
  } catch (err: any) {
    console.error(`[Shard ${shardIndex}] Fatal execution error:`, err);
    process.exit(1);
  }
}

async function processClaimedMedia(
  media: any,
  supabase: any,
  drive: any,
  accessToken: string,
  googleDriveFolderId: string,
) {
  await setBrowserPreparationState(supabase, media, "processing");
  if (media.audio_streams?.browserHls) {
    await supabase
      .from("media_library")
      .update({ processing_status: "ready" })
      .eq("id", media.id);
  } else if (media.processed_drive_file_id) {
    await prepareHlsFromExistingVariants(
      media,
      supabase,
      drive,
      accessToken,
      googleDriveFolderId,
    );
  } else {
    await processSingleMedia(
      media.id,
      media.drive_file_id,
      media.title,
      supabase,
      drive,
      accessToken,
      googleDriveFolderId,
    );
  }
}

function cleanLanguage(value: unknown, fallback: string) {
  const language = typeof value === "string" ? value.trim().toLowerCase() : "";
  return language || fallback;
}

function audioLabel(track: { language: string; title?: string; channels?: number }) {
  const base = track.title?.trim() || track.language.toUpperCase();
  const layout = track.channels && track.channels > 2 ? `${track.channels} channels` : "Stereo";
  return `${base} · ${layout}`;
}

async function prepareHlsFromExistingVariants(
  media: any,
  supabase: any,
  drive: any,
  accessToken: string,
  googleDriveFolderId: string,
) {
  const defaultId = media.processed_drive_file_id;
  const variants = (Array.isArray(media.audio_variants) ? media.audio_variants : [])
    .filter((variant: AudioVariant) => variant?.driveFileId);
  const uniqueVariants: AudioVariant[] = [
    {
      language: variants[0]?.language || "default",
      driveFileId: defaultId,
    },
    ...variants,
  ].filter(
    (variant, index, items) =>
      items.findIndex((item) => item.driveFileId === variant.driveFileId) === index,
  );
  const streams = Array.isArray(media.audio_streams)
    ? media.audio_streams
    : media.audio_streams?.tracks || [];
  const authHeaders = `Authorization: Bearer ${accessToken}\r\n`;
  const sourceUrl = (fileId: string) =>
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const hlsManifest = await packageBrowserHls({
    mediaId: media.id,
    title: media.title,
    video: {
      input: sourceUrl(defaultId),
      headers: authHeaders,
      streamIndex: 0,
      width: null,
      height: null,
      bandwidth: 8_000_000,
    },
    audio: uniqueVariants.map((variant, index) => {
      const stream = streams[index] || {};
      const language = cleanLanguage(variant.language || stream.language, `track-${index + 1}`);
      const channels = Number(stream.channels) || 2;
      return {
        input: sourceUrl(variant.driveFileId),
        headers: authHeaders,
        streamIndex: 0,
        index,
        language,
        label: audioLabel({ language, title: stream.title, channels }),
        channels,
        default: index === 0,
      };
    }),
    drive,
    parentFolderId: googleDriveFolderId,
  });

  const { error } = await supabase
    .from("media_library")
    .update({
      audio_streams: {
        version: 2,
        tracks: streams,
        browserHls: hlsManifest,
      },
      processing_status: "ready",
    })
    .eq("id", media.id);
  if (error) throw error;
}

async function setBrowserPreparationState(
  supabase: any,
  media: any,
  state: "processing" | "failed",
) {
  const existing = Array.isArray(media.audio_streams)
    ? { version: 2, tracks: media.audio_streams }
    : media.audio_streams || { version: 2, tracks: [] };
  const previous = existing.browserPreparation || {};

  await supabase
    .from("media_library")
    .update({
      processing_status: state,
      audio_streams: {
        ...existing,
        browserPreparation: {
          ...previous,
          state,
          requestedAt: previous.requestedAt || new Date().toISOString(),
          attempt: previous.attempt || 1,
          delivery: "queue",
        },
      },
    })
    .eq("id", media.id);
}

async function processSingleMedia(
  mediaId: string,
  sourceFileId: string,
  title: string,
  supabase: any,
  drive: any,
  accessToken: string,
  googleDriveFolderId: string
) {
  const sourceUrl = `https://www.googleapis.com/drive/v3/files/${sourceFileId}?alt=media`;

  // 1. Probe the source file
  console.log(`[Shard ${shardIndex}] Probing file streams for ${title}...`);
  const ffprobeOutput = execSync(
    `ffprobe -v quiet -print_format json -show_streams -show_format -headers "Authorization: Bearer ${accessToken}\r\n" "${sourceUrl}"`,
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

  console.log(`[Shard ${shardIndex}] Video codec: ${videoStream.codec_name}, HDR: ${isHDR}, DV Profile: ${dvProfile}`);

  // Collect all audio tracks
  let audioIdx = 0;
  const audioTracks: any[] = [];
  for (const s of streams) {
    if (s.codec_type !== "audio") continue;
    audioTracks.push({
      index: audioIdx++,
      language: cleanLanguage(s.tags?.language, `track-${audioIdx}`),
      title: s.tags?.title || undefined,
      codec: s.codec_name,
      channels: s.channels,
      default: s.disposition?.default === 1,
    });
  }
  console.log(`[Shard ${shardIndex}] Found ${audioTracks.length} audio track(s).`);

  // 2. Single-pass subtitle extraction
  const subtitleTracks: SubtitleTrack[] = [];
  const textSubtitleCodecs = new Set(["subrip", "srt", "webvtt", "ass", "ssa", "mov_text", "text", "microdvd"]);
  
  const subtitleTracksToExtract: Array<{
    ffmpegIndex: number;
    id: string;
    language: string;
    label: string;
    forced: boolean;
  }> = [];
  let subIdx = 0;
  for (const s of streams) {
    if (s.codec_type !== "subtitle") continue;
    const currentIdx = subIdx++;
    if (!textSubtitleCodecs.has(s.codec_name)) continue;
    
    const language = cleanLanguage(s.tags?.language, `track-${currentIdx + 1}`);
    subtitleTracksToExtract.push({
      ffmpegIndex: currentIdx,
      id: `${language}-${currentIdx}`,
      language,
      label: s.tags?.title || language.toUpperCase(),
      forced: s.disposition?.forced === 1,
    });
  }

  if (subtitleTracksToExtract.length > 0) {
    console.log(`[Shard ${shardIndex}] Extracting ${subtitleTracksToExtract.length} subtitle tracks in a single pass...`);
    console.time(`[Shard ${shardIndex}] Subtitle Extraction Phase`);
    
    try {
      const ffmpegArgs = ["-y", "-headers", `Authorization: Bearer ${accessToken}\r\n`, "-i", sourceUrl];
      for (const track of subtitleTracksToExtract) {
        ffmpegArgs.push("-map", `0:s:${track.ffmpegIndex}`, "-f", "webvtt", `sub_${track.ffmpegIndex}.vtt`);
      }
      
      execFileSync("ffmpeg", ffmpegArgs, { stdio: "ignore" });

      for (const track of subtitleTracksToExtract) {
        const filename = `sub_${track.ffmpegIndex}.vtt`;
        if (fs.existsSync(filename)) {
          const content = fs.readFileSync(filename, "utf8");
          subtitleTracks.push({
            id: track.id,
            language: track.language,
            label: track.label,
            forced: track.forced,
            content,
          });
          fs.unlinkSync(filename);
        }
      }
    } catch (err) {
      console.warn(`[Shard ${shardIndex}] Failed single-pass subtitle extraction:`, err);
    }
    console.timeEnd(`[Shard ${shardIndex}] Subtitle Extraction Phase`);
  }

  // Check if file is already web-compatible (H.264 video, AAC/MP3/Opus audio, no Dolby Vision, MP4 container)
  const isMp4 = parsedProbe.format?.format_name?.split(",").includes("mp4") || false;
  const isCompatibleVideo = videoStream.codec_name === "h264";
  const isCompatibleAudio = audioTracks.length > 0 && 
    ["aac", "mp3", "opus"].includes(audioTracks[0].codec?.toLowerCase());
  
  const isCompatible = (dvProfile === null) && isCompatibleVideo && isCompatibleAudio && isMp4;

  if (isCompatible) {
    console.log(`[Shard ${shardIndex}] Media ${title} is already fully web-compatible. Bypassing transcode.`);
    
    const audioVariants: AudioVariant[] = [
      { language: audioTracks[0]?.language || "default", driveFileId: sourceFileId },
    ];
    
    const authHeaders = `Authorization: Bearer ${accessToken}\r\n`;
    const hlsManifest = await packageBrowserHls({
      mediaId,
      title,
      video: {
        input: sourceUrl,
        headers: authHeaders,
        streamIndex: 0,
        width: videoStream.width || null,
        height: videoStream.height || null,
        bandwidth: Number(parsedProbe.format?.bit_rate) || 8_000_000,
      },
      audio: audioTracks.map((track, index) => ({
        input: sourceUrl,
        headers: authHeaders,
        streamIndex: track.index,
        index,
        language: track.language,
        label: audioLabel(track),
        channels: track.channels || 2,
        default: index === 0,
      })),
      drive,
      parentFolderId: googleDriveFolderId,
    });

    const { error: updateError } = await supabase
      .from("media_library")
      .update({
        processed_drive_file_id: sourceFileId,
        processing_status: "ready",
        audio_codec: audioTracks[0].codec,
        mime_type: "video/mp4",
        audio_variants: audioVariants as any,
        subtitle_tracks: subtitleTracks as any,
        audio_streams: {
          version: 2,
          tracks: audioTracks,
          browserHls: hlsManifest,
        } as any,
      })
      .eq("id", mediaId);

    if (updateError) throw updateError;
    console.log(`[Shard ${shardIndex}] Successfully marked ${title} as ready.`);
    return;
  }

  // 3. Single-pass transcode: transcode video and transcode ALL audio tracks to separate local files in one read
  console.log(`[Shard ${shardIndex}] Starting transcode phase for ${title}...`);
  console.time(`[Shard ${shardIndex}] Transcoding Phase`);

  const outputFilename = "output_default.mp4";
  if (fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);

  // Clean up any remaining aac files
  for (let i = 1; i < audioTracks.length; i++) {
    const localAudio = `audio_${i}.aac`;
    if (fs.existsSync(localAudio)) fs.unlinkSync(localAudio);
  }

  const shouldStripDovi = dvProfile === 7 || dvProfile === 8;
  const vfFilters = isHDR
    ? "zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
    : "scale=1920:-2,format=yuv420p";

  const videoCodecStr = isCompatibleVideo && !isHDR
    ? "-c:v copy"
    : `-c:v libx264 -preset veryfast -crf 22 -vf "${vfFilters}"`;
  const aacOptions = (track: any) => {
    const channels = Math.max(1, Math.min(Number(track?.channels) || 2, 6));
    return `-c:a aac -ac ${channels} -b:a ${channels > 2 ? "384k" : "192k"}`;
  };
  const defaultAudioOptions = aacOptions(audioTracks[0]);

  // Build audio mapping args dynamically for single-pass transcode
  let extraAudioArgs = "";
  if (shouldStripDovi) {
    for (let i = 1; i < audioTracks.length; i++) {
      extraAudioArgs += ` -map 1:a:${i} ${aacOptions(audioTracks[i])} audio_${i}.aac`;
    }
  } else {
    for (let i = 1; i < audioTracks.length; i++) {
      extraAudioArgs += ` -map 0:a:${i} ${aacOptions(audioTracks[i])} audio_${i}.aac`;
    }
  }

  if (shouldStripDovi) {
    console.log(`[Shard ${shardIndex}] Dolby Vision Profile 7/8 detected. Running dovi_tool extraction pipeline...`);
    const pipeCommand = `curl -s -H "Authorization: Bearer ${accessToken}" -L "${sourceUrl}" | ` +
      `ffmpeg -y -i pipe:0 -an -c:v copy -bsf:v hevc_mp4toannexb -f hevc pipe:1 | ` +
      `dovi_tool remove - -o - | ` +
      `ffmpeg -y -i pipe:0 -headers "Authorization: Bearer ${accessToken}\r\n" -i "${sourceUrl}" ` +
      `-map 0:v -map 1:a:0 ${videoCodecStr} ${defaultAudioOptions} -movflags +faststart ${outputFilename}${extraAudioArgs}`;
    
    execSync(pipeCommand, { stdio: "inherit" });
  } else {
    console.log(`[Shard ${shardIndex}] Running transcode pipeline with ${videoCodecStr}...`);
    const transcodeCommand = `ffmpeg -y -headers "Authorization: Bearer ${accessToken}\r\n" -i "${sourceUrl}" ` +
      `-map 0:v:0 -map 0:a:0 ${videoCodecStr} ${defaultAudioOptions} -movflags +faststart ${outputFilename}${extraAudioArgs}`;
    
    execSync(transcodeCommand, { stdio: "inherit" });
  }
  console.timeEnd(`[Shard ${shardIndex}] Transcoding Phase`);

  if (!fs.existsSync(outputFilename) || fs.statSync(outputFilename).size === 0) {
    throw new Error("Transcode output default file is empty or was not created.");
  }

  // 4. Upload main variant to Google Drive
  console.log(`[Shard ${shardIndex}] Uploading main variant of ${title} to Google Drive...`);
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
  console.log(`[Shard ${shardIndex}] Default variant uploaded. Drive File ID: ${newDefaultFileId}`);

  // 5. Local mux and upload for additional audio tracks (index > 0)
  const audioVariants: AudioVariant[] = [
    { language: audioTracks[0]?.language || "default", driveFileId: newDefaultFileId },
  ];

  if (audioTracks.length > 1) {
    console.log(`[Shard ${shardIndex}] Muxing secondary audio variants locally...`);
    console.time(`[Shard ${shardIndex}] Secondary Audio Mux Phase`);

    for (let i = 1; i < audioTracks.length; i++) {
      const track = audioTracks[i];
      const localAudioFile = `audio_${i}.aac`;
      const variantFilename = `output_variant_${i}.mp4`;

      if (!fs.existsSync(localAudioFile)) {
        console.warn(`[Shard ${shardIndex}] Expected local audio file ${localAudioFile} was not found.`);
        continue;
      }

      if (fs.existsSync(variantFilename)) fs.unlinkSync(variantFilename);

      // Mux the local H.264 video with the local transcoded AAC track
      const muxCommand = `ffmpeg -y -i ${outputFilename} -i ${localAudioFile} -map 0:v:0 -c:v copy -map 1:a:0 -c:a copy -movflags +faststart ${variantFilename}`;
      execSync(muxCommand, { stdio: "ignore" });

      if (fs.existsSync(variantFilename) && fs.statSync(variantFilename).size > 0) {
        console.log(`[Shard ${shardIndex}] Uploading variant ${i} (lang: ${track.language}) to Google Drive...`);
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
          console.log(`[Shard ${shardIndex}] Variant uploaded. File ID: ${variantFileId}`);
        }
        fs.unlinkSync(variantFilename);
      }
      
      fs.unlinkSync(localAudioFile);
    }
    console.timeEnd(`[Shard ${shardIndex}] Secondary Audio Mux Phase`);
  }

  const authHeaders = `Authorization: Bearer ${accessToken}\r\n`;
  const browserSourceUrl = (fileId: string) =>
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const hlsManifest = await packageBrowserHls({
    mediaId,
    title,
    video: {
      input: browserSourceUrl(newDefaultFileId),
      headers: authHeaders,
      streamIndex: 0,
      width: isCompatibleVideo ? videoStream.width || null : 1920,
      height: isCompatibleVideo ? videoStream.height || null : null,
      bandwidth: 8_000_000,
    },
    audio: audioVariants.map((variant, index) => {
      const track = audioTracks[index] || {};
      const language = cleanLanguage(variant.language || track.language, `track-${index + 1}`);
      return {
        input: browserSourceUrl(variant.driveFileId),
        headers: authHeaders,
        streamIndex: 0,
        index,
        language,
        label: audioLabel({
          language,
          title: track.title,
          channels: track.channels,
        }),
        channels: track.channels || 2,
        default: index === 0,
      };
    }),
    drive,
    parentFolderId: googleDriveFolderId,
  });

  // Clean up transcode output
  fs.unlinkSync(outputFilename);

  // 6. Update Supabase with results
  console.log(`[Shard ${shardIndex}] Processing complete for ${title}. Updating database...`);
  const { error: updateError } = await supabase
    .from("media_library")
    .update({
      processed_drive_file_id: newDefaultFileId,
      processing_status: "ready",
      dv_profile: null,
      audio_codec: "aac",
      mime_type: "video/mp4",
      audio_variants: audioVariants as any,
      subtitle_tracks: subtitleTracks as any,
      audio_streams: {
        version: 2,
        tracks: audioTracks,
        browserHls: hlsManifest,
      } as any,
    })
    .eq("id", mediaId);

  if (updateError) {
    throw updateError;
  }
  console.log(`[Shard ${shardIndex}] Successfully finished catalog update for ${title}.`);
}

main();
