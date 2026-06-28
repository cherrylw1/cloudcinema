"use client";

import { useEffect, useRef, useState } from "react";
import type { Media, AudioVariant, SubtitleTrack } from "@/repositories/media";
import type { UserProgress } from "@/repositories/progress";
import { saveProgressAction } from "@/server/actions/progress-actions";
import { Loader2, AlertCircle } from "lucide-react";

interface VideoPlayerProps {
  media: Media;
  initialProgress: UserProgress | null;
}

function formatLanguage(lang: string | null): string {
  if (!lang) return "Unknown Language";
  const lower = lang.toLowerCase();
  const mapping: Record<string, string> = {
    eng: "English",
    en: "English",
    jpn: "Japanese",
    ja: "Japanese",
    fre: "French",
    fra: "French",
    fr: "French",
    spa: "Spanish",
    es: "Spanish",
    ger: "German",
    deu: "German",
    de: "German",
    chi: "Chinese",
    zho: "Chinese",
    zh: "Chinese",
    rus: "Russian",
    ru: "Russian",
    ita: "Italian",
    it: "Italian",
    por: "Portuguese",
    pt: "Portuguese",
    kor: "Korean",
    ko: "Korean",
  };
  return mapping[lower] || lang.toUpperCase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRowToMedia(row: any): Media {
  return {
    id: row.id,
    driveFileId: row.drive_file_id,
    title: row.title,
    series: row.series,
    season: row.season,
    episode: row.episode,
    mediaType: row.media_type,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    runtime: row.runtime,
    fileSize: row.file_size,
    tmdbId: row.tmdb_id,
    mimeType: row.mime_type,
    dvProfile: row.dv_profile,
    audioCodec: row.audio_codec,
    audioStreams: row.audio_streams,
    subtitleStreams: row.subtitle_streams,
    processingStatus: row.processing_status,
    audioVariants: row.audio_variants,
    subtitleTracks: row.subtitle_tracks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function VideoPlayer({ media, initialProgress }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initialSeekDone = useRef(false);
  const lastSavedTime = useRef<number>(0);
  const seekTargetRef = useRef<number | null>(null);

  const [activeMedia, setActiveMedia] = useState<Media>(media);
  const [status, setStatus] = useState<string>(media.processingStatus || "none");
  const [selectedAudioVariant, setSelectedAudioVariant] = useState<string>(media.driveFileId);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("off");



  // Poll processing status if not ready or failed
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/process/prepare/${media.id}`, { method: "POST" });
        if (!res.ok) throw new Error("Status check failed");
        
        const data = await res.json();
        const currentStatus = data.status || "none";
        setStatus(currentStatus);

        if (data.media) {
          const mapped = mapDbRowToMedia(data.media);
          setActiveMedia(mapped);
          if (currentStatus === "ready") {
            setSelectedAudioVariant(mapped.driveFileId);
          }
        }

        if (currentStatus === "ready" || currentStatus === "failed") {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (err) {
        console.error("[VideoPlayer] Status polling error:", err);
      }
    };

    // Initial check immediately
    checkStatus();

    // Start polling if not completed
    if (status === "none" || status === "processing") {
      intervalId = setInterval(checkStatus, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [media.id, status]);

  // Audio variant selector handler with seamless re-seek
  const handleAudioChange = (driveFileId: string) => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      seekTargetRef.current = currentTime;
      initialSeekDone.current = false;
      console.log(`[VideoPlayer] Swapping audio variant. Saved current position: ${currentTime}s`);
    }
    setSelectedAudioVariant(driveFileId);
  };

  // Auto-seek to starting playback position when video metadata is loaded
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;

    if (seekTargetRef.current !== null) {
      videoRef.current.currentTime = seekTargetRef.current;
      lastSavedTime.current = seekTargetRef.current;
      console.log(`[VideoPlayer] Restored position after variant change: ${seekTargetRef.current}s`);
      seekTargetRef.current = null;
      initialSeekDone.current = true;
    } else if (
      initialProgress &&
      !initialProgress.completed &&
      initialProgress.playbackPosition > 0 &&
      !initialSeekDone.current
    ) {
      initialSeekDone.current = true;
      videoRef.current.currentTime = initialProgress.playbackPosition;
      lastSavedTime.current = initialProgress.playbackPosition;
      console.log(`[VideoPlayer] Auto-seeking to saved position: ${initialProgress.playbackPosition}s`);
    }
  };

  // Throttled timeupdate listener (fires every 10 seconds of playback)
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;

    const currentTime = Math.floor(videoRef.current.currentTime);
    
    // Save progress if 10 seconds of delta have passed since last save
    if (Math.abs(currentTime - lastSavedTime.current) >= 10) {
      lastSavedTime.current = currentTime;
      saveProgressAction(activeMedia.id, currentTime, false).catch((err) => {
        console.error("[VideoPlayer] Failed to auto-save playback position:", err);
      });
    }
  };

  // Handle video playback ended event
  const handleEnded = () => {
    lastSavedTime.current = 0;
    saveProgressAction(activeMedia.id, 0, true).catch((err) => {
      console.error("[VideoPlayer] Failed to save completion state:", err);
    });
    console.log("[VideoPlayer] Playback completed. Marked as watched.");
  };

  // Clean up component by saving current position if the user navigates away mid-play
  useEffect(() => {
    const videoElement = videoRef.current;
    return () => {
      if (videoElement) {
        const currentTime = Math.floor(videoElement.currentTime);
        const isEnded = videoElement.ended;
        
        if (currentTime > 0 && !isEnded) {
          saveProgressAction(activeMedia.id, currentTime, false).catch((err) => {
            console.error("[VideoPlayer] Failed to save progress on unmount:", err);
          });
        }
      }
    };
  }, [activeMedia.id]);

  // Loading and error states UI
  if (status === "none" || status === "processing") {
    return (
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/60 border border-white/[0.08] flex flex-col items-center justify-center p-8 shadow-2xl backdrop-blur-md">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h3 className="text-md font-semibold text-foreground mb-2 flex items-center gap-2">
          Preparing Media Pipeline
        </h3>
        <p className="text-xs text-foreground/60 text-center max-w-md leading-relaxed">
          Your media is being prepared and optimized for web playback. This involves stripping Dolby Vision green/pink colorspace layers, tonemapping HDR colors to standard Rec.709 SDR, and indexing language tracks. Please wait...
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/60 border border-red-500/20 flex flex-col items-center justify-center p-8 shadow-2xl backdrop-blur-md">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-md font-semibold text-foreground mb-2">Preparation Failed</h3>
        <p className="text-xs text-foreground/60 text-center max-w-md leading-relaxed">
          Media preparation failed. Please verify repository secrets are correctly configured or check GitHub Action execution logs.
        </p>
      </div>
    );
  }

  const streamUrl = `/api/stream/${selectedAudioVariant}`;
  const showAudioSelector = activeMedia.audioVariants && activeMedia.audioVariants.length > 1;
  const showSubtitleSelector = activeMedia.subtitleTracks && activeMedia.subtitleTracks.length > 0;

  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-border/40 shadow-2xl">
        <video
          ref={videoRef}
          controls
          autoPlay
          src={streamUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          className="w-full h-full object-contain"
        >
          {selectedSubtitle !== "off" && (
            <track
              key={selectedSubtitle}
              kind="subtitles"
              src={`/api/subtitles/${activeMedia.id}/${selectedSubtitle}`}
              srcLang={selectedSubtitle}
              label={formatLanguage(selectedSubtitle)}
              default
            />
          )}
          Your browser does not support HTML5 video streaming.
        </video>
      </div>

      {/* Selectors control bar */}
      {(showAudioSelector || showSubtitleSelector) && (
        <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md">
          {/* Audio Language Variant Selector */}
          {showAudioSelector && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Audio Language</label>
              <select
                value={selectedAudioVariant}
                onChange={(e) => handleAudioChange(e.target.value)}
                className="bg-black/50 border border-white/[0.15] rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/80 transition-colors cursor-pointer min-w-[200px]"
              >
                {activeMedia.audioVariants?.map((v: AudioVariant, index: number) => (
                  <option key={v.driveFileId} value={v.driveFileId} className="bg-zinc-900 text-foreground">
                    {index === 0 ? "Default - " : ""}
                    {formatLanguage(v.language)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subtitles Selector Dropdown */}
          {showSubtitleSelector && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Subtitles</label>
              <select
                value={selectedSubtitle}
                onChange={(e) => setSelectedSubtitle(e.target.value)}
                className="bg-black/50 border border-white/[0.15] rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/80 transition-colors cursor-pointer min-w-[200px]"
              >
                <option value="off" className="bg-zinc-900 text-foreground">Off</option>
                {activeMedia.subtitleTracks?.map((stream: SubtitleTrack) => (
                  <option key={stream.language} value={stream.language} className="bg-zinc-900 text-foreground">
                    {formatLanguage(stream.language)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
