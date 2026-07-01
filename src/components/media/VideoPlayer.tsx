"use client";

import { useEffect, useRef, useState } from "react";
import type { Media, AudioVariant, SubtitleTrack } from "@/repositories/media";
import type { UserProgress } from "@/repositories/progress";
import { saveProgressAction } from "@/server/actions/progress-actions";
import { ExternalLink, Copy, Check } from "lucide-react";

interface VideoPlayerProps {
  media: Media;
  initialProgress: UserProgress | null;
  streamToken: string;
  userId: string;
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


export function VideoPlayer({ media, initialProgress, streamToken, userId }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initialSeekDone = useRef(false);
  const lastSavedTime = useRef<number>(0);
  const seekTargetRef = useRef<number | null>(null);

  const [activeMedia] = useState<Media>(media);
  const [selectedAudioVariant, setSelectedAudioVariant] = useState<string>(media.processedDriveFileId || media.driveFileId);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("off");
  const [copied, setCopied] = useState(false);

  // Construct absolute stream URL with signed credentials
  const getStreamUrl = () => {
    if (typeof window === "undefined") return "";
    const variantQuery = selectedAudioVariant !== (activeMedia.processedDriveFileId || activeMedia.driveFileId)
      ? `&driveFileId=${selectedAudioVariant}`
      : "";
    return `${window.location.origin}/api/stream/${activeMedia.id}?token=${streamToken}&uid=${userId}${variantQuery}`;
  };

  const handleCopyLink = async () => {
    try {
      const url = getStreamUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

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

      {/* External Players Integration */}
      {typeof window !== "undefined" && (
        <div className="mt-4 p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground/90">Play in External Player</h3>
              <p className="text-xs text-foreground/45 mt-0.5">
                If your browser experiences green/purple tints, has no audio, or struggles with 4K HDR playback.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-1">
            <a 
              href={`vlc://${getStreamUrl().replace(/^https?:\/\//, "")}`} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/10 text-orange-500 border border-orange-600/20 hover:bg-orange-600/20 hover:text-orange-400 transition-all text-xs font-semibold cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Play in VLC
            </a>
            <a 
              href={`potplayer://${getStreamUrl()}`} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-600/10 text-yellow-500 border border-yellow-600/20 hover:bg-yellow-600/20 hover:text-yellow-400 transition-all text-xs font-semibold cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Play in PotPlayer
            </a>
            <a 
              href={`infuse://x-callback-url/play?url=${encodeURIComponent(getStreamUrl())}`} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600/20 hover:text-blue-300 transition-all text-xs font-semibold cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Play in Infuse
            </a>
            <a 
              href={`iina://weblink?url=${encodeURIComponent(getStreamUrl())}`} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600/20 hover:text-indigo-300 transition-all text-xs font-semibold cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Play in IINA
            </a>
            <button 
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20 hover:text-emerald-300 transition-all text-xs font-semibold cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied Link!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Stream Link
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
