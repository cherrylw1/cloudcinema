"use client";

import { useEffect, useRef, useState } from "react";
import type { Media } from "@/repositories/media";
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
  
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(0);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<string>("off");
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  
  const seekTargetRef = useRef<number | null>(null);

  // Determine browser capability and select stream route on mount / audio track change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const video = document.createElement("video");
    const mime = media.mimeType || "video/mp4";
    const canPlay = video.canPlayType(mime);

    if (selectedAudioTrack > 0) {
      // Force remux proxy whenever a non-default audio track is chosen
      setStreamUrl(`/api/stream-remux/${media.id}?audioTrack=${selectedAudioTrack}`);
      console.log(`[VideoPlayer] Custom audio track selected (${selectedAudioTrack}). Routing to remuxer.`);
    } else {
      // Default audio track (index 0)
      if (canPlay === "probably" || canPlay === "maybe") {
        setStreamUrl(`/api/stream/${media.id}`);
        console.log(`[VideoPlayer] Browser supports direct playback for ${mime}. Routing to: /api/stream/${media.id}`);
      } else {
        setStreamUrl(`/api/stream-remux/${media.id}`);
        console.log(`[VideoPlayer] Browser does not support ${mime}. Routing to remuxer: /api/stream-remux/${media.id}`);
      }
    }
  }, [media.id, media.mimeType, selectedAudioTrack]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Audio track selector handler with seamless re-seek
  const handleAudioTrackChange = (index: number) => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      seekTargetRef.current = currentTime;
      initialSeekDone.current = false;
      console.log(`[VideoPlayer] Changing audio track to ${index}. Saved current position: ${currentTime}s`);
    }
    setSelectedAudioTrack(index);
  };

  // Auto-seek to starting playback position when video metadata is loaded
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;

    if (seekTargetRef.current !== null) {
      videoRef.current.currentTime = seekTargetRef.current;
      lastSavedTime.current = seekTargetRef.current;
      console.log(`[VideoPlayer] Restored position after track change: ${seekTargetRef.current}s`);
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
      saveProgressAction(media.id, currentTime, false).catch((err) => {
        console.error("[VideoPlayer] Failed to auto-save playback position:", err);
      });
    }
  };

  // Handle video playback ended event
  const handleEnded = () => {
    lastSavedTime.current = 0;
    saveProgressAction(media.id, 0, true).catch((err) => {
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
          saveProgressAction(media.id, currentTime, false).catch((err) => {
            console.error("[VideoPlayer] Failed to save progress on unmount:", err);
          });
        }
      }
    };
  }, [media.id]);

  if (!streamUrl) {
    return (
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-border/40 shadow-2xl">
        <div className="text-xs text-foreground/40 animate-pulse">Initializing video stream...</div>
      </div>
    );
  }

  const showAudioSelector = media.audioStreams && media.audioStreams.length > 1;
  const showSubtitleSelector = media.subtitleStreams && media.subtitleStreams.length > 0;

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
          {selectedSubtitleTrack !== "off" && (
            <track
              key={selectedSubtitleTrack}
              kind="subtitles"
              src={`/api/subtitles/${media.id}/${selectedSubtitleTrack}`}
              srcLang={
                media.subtitleStreams?.find(
                  (s) => s.index === parseInt(selectedSubtitleTrack, 10)
                )?.language || "en"
              }
              label={
                formatLanguage(
                  media.subtitleStreams?.find(
                    (s) => s.index === parseInt(selectedSubtitleTrack, 10)
                  )?.language || null
                )
              }
              default
            />
          )}
          Your browser does not support HTML5 video streaming.
        </video>
      </div>

      {/* Selectors control bar */}
      {(showAudioSelector || showSubtitleSelector) && (
        <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md">
          {/* Audio Selector Dropdown */}
          {showAudioSelector && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Audio Language</label>
              <select
                value={selectedAudioTrack}
                onChange={(e) => handleAudioTrackChange(parseInt(e.target.value, 10))}
                className="bg-black/50 border border-white/[0.15] rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/80 transition-colors cursor-pointer min-w-[200px]"
              >
                {media.audioStreams?.map((stream) => (
                  <option key={stream.index} value={stream.index} className="bg-zinc-900 text-foreground">
                    {stream.index === 0 ? "Default - " : ""}
                    {formatLanguage(stream.language)} ({stream.codec?.toUpperCase() || "UNKNOWN"}{stream.channels ? `, ${stream.channels}ch` : ""})
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
                value={selectedSubtitleTrack}
                onChange={(e) => setSelectedSubtitleTrack(e.target.value)}
                className="bg-black/50 border border-white/[0.15] rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/80 transition-colors cursor-pointer min-w-[200px]"
              >
                <option value="off" className="bg-zinc-900 text-foreground">Off</option>
                {media.subtitleStreams?.map((stream) => (
                  <option key={stream.index} value={stream.index} className="bg-zinc-900 text-foreground">
                    {formatLanguage(stream.language)} ({stream.codec?.toUpperCase() || "SRT"})
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
