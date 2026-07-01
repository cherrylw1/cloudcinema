"use client";

import { useEffect, useRef, useState } from "react";
import type { Media, AudioVariant, SubtitleTrack } from "@/repositories/media";
import type { UserProgress } from "@/repositories/progress";
import { saveProgressAction } from "@/server/actions/progress-actions";

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


export function VideoPlayer({ media, initialProgress }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initialSeekDone = useRef(false);
  const lastSavedTime = useRef<number>(0);
  const seekTargetRef = useRef<number | null>(null);

  const [activeMedia] = useState<Media>(media);
  const [selectedAudioVariant, setSelectedAudioVariant] = useState<string>(media.processedDriveFileId || media.driveFileId);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("off");

  // Trigger transcode process silently in the background on load
  useEffect(() => {
    fetch(`/api/process/prepare/${media.id}`, { method: "POST" }).catch((err) => {
      console.error("[VideoPlayer] Silent prepare trigger failed:", err);
    });
  }, [media.id]);

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

  const streamUrl = selectedAudioVariant === (activeMedia.processedDriveFileId || activeMedia.driveFileId)
    ? `/api/stream/${activeMedia.id}`
    : `/api/stream/${activeMedia.id}?driveFileId=${selectedAudioVariant}`;
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
