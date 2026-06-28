"use client";

import { useEffect, useRef, useState } from "react";
import type { Media } from "@/repositories/media";
import type { UserProgress } from "@/repositories/progress";
import { saveProgressAction } from "@/server/actions/progress-actions";

interface VideoPlayerProps {
  media: Media;
  initialProgress: UserProgress | null;
}

export function VideoPlayer({ media, initialProgress }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initialSeekDone = useRef(false);
  const lastSavedTime = useRef<number>(0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  // Determine browser capability and select stream route on mount
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const video = document.createElement("video");
    const mime = media.mimeType || "video/mp4";
    const canPlay = video.canPlayType(mime);

    if (canPlay === "probably" || canPlay === "maybe") {
      setStreamUrl(`/api/stream/${media.id}`);
      console.log(`[VideoPlayer] Browser supports direct playback for ${mime}. Routing to: /api/stream/${media.id}`);
    } else {
      setStreamUrl(`/api/stream-remux/${media.id}`);
      console.log(`[VideoPlayer] Browser does not support ${mime}. Routing to remuxer: /api/stream-remux/${media.id}`);
    }
  }, [media.id, media.mimeType]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-seek to starting playback position when video metadata is loaded
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;

    if (
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

  return (
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
        Your browser does not support HTML5 video streaming.
      </video>
    </div>
  );
}
