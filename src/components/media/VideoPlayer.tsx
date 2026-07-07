"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Media, SubtitleTrack } from "@/repositories/media";
import type { UserProgress } from "@/repositories/progress";
import { saveProgressAction } from "@/server/actions/progress-actions";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  ExternalLink, Copy, Check, Subtitles, Languages, Info,
  RotateCcw, RotateCw, ArrowLeft
} from "lucide-react";

// Safe static imports for Capacitor
import { Capacitor } from "@capacitor/core";
import { VideoPlayer as CapVideoPlayer } from "@capgo/capacitor-video-player";

interface VideoPlayerProps {
  media: Media;
  initialProgress: UserProgress | null;
  streamToken: string;
  userId: string;
  nextEpisode?: Media | null;
}

function formatLanguage(lang: string | null): string {
  if (!lang) return "Unknown";
  const lower = lang.toLowerCase();
  const mapping: Record<string, string> = {
    eng: "English",    en: "English",
    jpn: "Japanese",   ja: "Japanese",
    fre: "French",     fra: "French", fr: "French",
    spa: "Spanish",    es: "Spanish",
    ger: "German",     deu: "German", de: "German",
    chi: "Chinese",    zho: "Chinese", zh: "Chinese",
    rus: "Russian",    ru: "Russian",
    ita: "Italian",    it: "Italian",
    por: "Portuguese", pt: "Portuguese",
    kor: "Korean",     ko: "Korean",
  };
  return mapping[lower] || lang.toUpperCase();
}

function formatTime(secs: number): string {
  if (!isFinite(secs) || isNaN(secs) || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({
  media,
  initialProgress,
  streamToken,
  userId,
  nextEpisode,
}: VideoPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  // Internal refs that don't need to trigger re-renders
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialSeekDone = useRef(false);
  const lastSavedTime = useRef<number>(0);
  const seekTargetRef = useRef<number | null>(null);
  const isDraggingSeek = useRef(false);
  const durationRef = useRef(0);

  // ── Platform / Device detection ───────────────────────────────────────────
  const [isNative, setIsNative] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // ── Core media selection state ────────────────────────────────────────────
  const [activeMedia] = useState<Media>(media);
  const [selectedAudioVariant, setSelectedAudioVariant] = useState<string>(
    media.processedDriveFileId || media.driveFileId
  );
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("off");
  const [copied, setCopied] = useState(false);

  // ── Player UI state ───────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [openMenu, setOpenMenu] = useState<"subs" | "audio" | null>(null);

  // ── Fullscreen state (prevents dynamic layout resizing issues) ───────────
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Next Episode state ────────────────────────────────────────────────────
  const [showNextCard, setShowNextCard] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const isTv = activeMedia.mediaType === "tv-show" || activeMedia.mediaType === "anime";
  const hasNextEpisode = isTv && !!nextEpisode;

  // Persist platform detection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobileTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      setIsTouchDevice(isMobileTouch);

      const hasPlatformParam = window.location.search.includes("platform=app");
      const isCapacitorNative = Capacitor.getPlatform() !== "web";
      const isSavedLocalNative = localStorage.getItem("isNativeApp") === "true";

      if (hasPlatformParam || isCapacitorNative || isSavedLocalNative) {
        localStorage.setItem("isNativeApp", "true");
        setIsNative(true);
      }
    }
  }, []);

  // Sync fullscreen state based on document fullscreen API
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Stream URL ────────────────────────────────────────────────────────────
  const streamUrl = selectedAudioVariant === (activeMedia.processedDriveFileId || activeMedia.driveFileId)
    ? `/api/stream/${activeMedia.id}`
    : `/api/stream/${activeMedia.id}?driveFileId=${selectedAudioVariant}`;

  const getAbsoluteStreamUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    const variantPath = selectedAudioVariant !== (activeMedia.processedDriveFileId || activeMedia.driveFileId)
      ? `/${selectedAudioVariant}`
      : "";
    return `${window.location.origin}/api/stream/${activeMedia.id}/${streamToken}/${userId}${variantPath}/video.mp4`;
  }, [activeMedia, selectedAudioVariant, streamToken, userId]);

  // ── Controls visibility timer ─────────────────────────────────────────────
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    setOpenMenu(null);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !isDraggingSeek.current) {
        setControlsVisible(false);
      }
    }, 4000);
  }, []);

  // Silence background prepare trigger
  useEffect(() => {
    fetch(`/api/process/prepare/${media.id}`, { method: "POST" }).catch(() => {});
  }, [media.id]);

  // Keyboard shortcuts (web player only)
  useEffect(() => {
    if (isNative) return;
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (!videoRef.current) return;
      switch (e.key) {
        case " ": case "k":
          e.preventDefault();
          videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
          revealControls();
          break;
        case "ArrowLeft":
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          revealControls();
          break;
        case "ArrowRight":
          e.preventDefault();
          videoRef.current.currentTime = Math.min(durationRef.current, videoRef.current.currentTime + 10);
          revealControls();
          break;
        case "f": case "F":
          e.preventDefault();
          handleToggleFullscreen();
          break;
        case "m": case "M":
          e.preventDefault();
          handleToggleMute();
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [revealControls, isNative]);

  // Seek bar mouse drag (web player desktop only)
  useEffect(() => {
    if (isNative || isTouchDevice) return;
    const onMove = (e: MouseEvent) => {
      if (!isDraggingSeek.current || !seekBarRef.current || !videoRef.current) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = ratio * durationRef.current;
    };
    const onUp = () => { isDraggingSeek.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isNative, isTouchDevice]);

  // Cleanup progress on unmount
  useEffect(() => {
    const videoElement = videoRef.current;
    return () => {
      if (videoElement && !videoElement.ended) {
        const ct = Math.floor(videoElement.currentTime);
        if (ct > 0) saveProgressAction(activeMedia.id, ct, false).catch(() => {});
      }
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [activeMedia.id]);

  // ── Web Player event handlers ─────────────────────────────────────────────
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    setDuration(dur);
    durationRef.current = dur;

    if (seekTargetRef.current !== null) {
      videoRef.current.currentTime = seekTargetRef.current;
      lastSavedTime.current = seekTargetRef.current;
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
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const ct = videoRef.current.currentTime;
    setCurrentTime(ct);

    if (Math.abs(Math.floor(ct) - lastSavedTime.current) >= 10) {
      lastSavedTime.current = Math.floor(ct);
      saveProgressAction(activeMedia.id, Math.floor(ct), false).catch(() => {});
    }

    if (hasNextEpisode && durationRef.current > 0) {
      const timeLeft = durationRef.current - ct;
      setShowNextCard(timeLeft > 0 && timeLeft <= 30);
    }
  };

  const handleEnded = () => {
    lastSavedTime.current = 0;
    saveProgressAction(activeMedia.id, 0, true).catch(() => {});
    setIsPlaying(false);
    setControlsVisible(true);

    if (hasNextEpisode && nextEpisode) {
      setShowNextCard(true);
      let count = 5;
      setCountdown(count);
      countdownTimerRef.current = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(countdownTimerRef.current!);
          router.push(`/watch/${nextEpisode.id}`);
        }
      }, 1000);
    }
  };

  // ── Touch and Drag event handlers for seekbar ─────────────────────────────
  const handleTouchSeek = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isDraggingSeek.current = true;
    if (!seekBarRef.current || !videoRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = ratio * durationRef.current;
    revealControls();
  };

  const handleTouchEnd = () => {
    isDraggingSeek.current = false;
  };

  // ── Action Handlers ───────────────────────────────────────────────────────
  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleVolumeChange = (val: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = val;
    setVolume(val);
    if (videoRef.current.muted && val > 0) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const handleSeekMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isDraggingSeek.current = true;
    if (!seekBarRef.current || !videoRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = ratio * durationRef.current;
    revealControls();
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {
        // Fallback for devices that don't support RequestFullscreen API cleanly (like iOS Safari / Capacitor WebView)
        setIsFullscreen(!isFullscreen);
      });
    }
  };

  const handleExitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  };

  const handleAudioChange = (driveFileId: string) => {
    if (videoRef.current) {
      seekTargetRef.current = videoRef.current.currentTime;
      initialSeekDone.current = false;
    }
    setSelectedAudioVariant(driveFileId);
    setOpenMenu(null);
  };

  const navigateToNext = useCallback(() => {
    if (!nextEpisode) return;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    router.push(`/watch/${nextEpisode.id}`);
  }, [nextEpisode, router]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getAbsoluteStreamUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // ── Capacitor Native Player Launcher (ExoPlayer) ──────────────────────────
  const startNativePlayer = async () => {
    if (!CapVideoPlayer) return;
    try {
      const url = getAbsoluteStreamUrl();

      // Add subtitle path if selected
      let subtitleUrl: string | undefined = undefined;
      if (selectedSubtitle !== "off") {
        subtitleUrl = `${window.location.origin}/api/subtitles/${activeMedia.id}/${selectedSubtitle}`;
      } else if (activeMedia.subtitleTracks && activeMedia.subtitleTracks.length > 0) {
        subtitleUrl = `${window.location.origin}/api/subtitles/${activeMedia.id}/${activeMedia.subtitleTracks[0].language}`;
      }

      // Add native player event listeners to save progress in background
      const pauseListener = await (CapVideoPlayer as any).addListener('jeepCapVideoPlayerPause', (data: any) => {
        if (data?.currentTime != null) {
          saveProgressAction(activeMedia.id, Math.floor(data.currentTime), false).catch(() => {});
        }
      });
      const endedListener = await (CapVideoPlayer as any).addListener('jeepCapVideoPlayerEnded', () => {
        saveProgressAction(activeMedia.id, 0, true).catch(() => {});
      });
      const exitListener = await (CapVideoPlayer as any).addListener('jeepCapVideoPlayerExit', (data: any) => {
        if (data?.currentTime != null) {
          saveProgressAction(activeMedia.id, Math.floor(data.currentTime), false).catch(() => {});
        }
        pauseListener.remove();
        endedListener.remove();
        exitListener.remove();
      });

      // Init and play native ExoPlayer
      const initOptions: any = {
        playerId: 'fullscreen',
        mode: 'fullscreen',
        url,
        title: activeMedia.title,
        smallTitle: isTv ? `Season ${activeMedia.season} · Episode ${activeMedia.episode}` : undefined,
        exitOnEnd: true,
        pipEnabled: true,
      };

      if (subtitleUrl) {
        initOptions.subtitle = subtitleUrl;
        initOptions.language = selectedSubtitle !== "off" ? selectedSubtitle : activeMedia.subtitleTracks?.[0]?.language;
      }

      await CapVideoPlayer.initPlayer(initOptions);

      // Seek if they have existing saved progress
      if (initialProgress && !initialProgress.completed && initialProgress.playbackPosition > 0) {
        await CapVideoPlayer.setCurrentTime({ playerId: 'fullscreen', seektime: initialProgress.playbackPosition });
      }

      await CapVideoPlayer.play({ playerId: 'fullscreen' });
    } catch (err) {
      console.error("Failed to start native player:", err);
    }
  };

  // ── Derived display values ────────────────────────────────────────────────
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">

      {/* ════════════════════════════════════════════════════════════════════
          Custom Netflix-style Player Container
      ════════════════════════════════════════════════════════════════════ */}
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden bg-black shadow-2xl group/player transition-all duration-300
          ${isFullscreen ? "fixed inset-0 w-screen h-screen z-50 rounded-none" : "aspect-video rounded-2xl"}`}
        onMouseMove={revealControls}
        onMouseLeave={() => {
          if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
        }}
        onClick={isNative ? undefined : (isTouchDevice ? revealControls : handleTogglePlay)}
        style={{ cursor: controlsVisible && !isNative ? "default" : "none" }}
      >
        {isNative ? (
          /* ── NATIVE CAPACITOR LAUNCH COVER ── */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950 relative">
            {activeMedia.backdropUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeMedia.backdropUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-20 filter blur-sm"
              />
            )}
            <div className="relative z-10 space-y-4 max-w-lg">
              <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-red-600/10 text-red-500 border border-red-600/20">
                <Info className="h-3 w-3" /> Native Android Player
              </span>
              <h2 className="text-2xl font-black text-white tracking-tight leading-snug">
                {activeMedia.title}
              </h2>
              {isTv && activeMedia.season != null && activeMedia.episode != null && (
                <p className="text-white/60 text-sm font-bold">
                  Season {activeMedia.season} · Episode {activeMedia.episode}
                </p>
              )}
              <p className="text-white/40 text-xs leading-relaxed max-w-sm mx-auto">
                Press play to open ExoPlayer natively. This supports full quality streaming, Dolby Digital audio tracks, and hardware acceleration.
              </p>
              <button
                onClick={startNativePlayer}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-red-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:bg-red-500 hover:scale-[1.03] transition-all cursor-pointer"
              >
                <Play className="h-5 w-5 fill-white" />
                Play Natively
              </button>
            </div>
          </div>
        ) : (
          /* ── WEB HTML5 PLAYER ── */
          <>
            <video
              ref={videoRef}
              src={streamUrl}
              autoPlay
              className="w-full h-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onPlay={() => { setIsPlaying(true); revealControls(); }}
              onPause={() => { setIsPlaying(false); setControlsVisible(true); }}
            />

            {/* ── Controls Overlay ── */}
            <div
              className={`absolute inset-0 transition-opacity duration-300 pointer-events-none flex flex-col justify-between ${controlsVisible ? "opacity-100" : "opacity-0"}`}
            >
              {/* TOP HEADER: Title & Info */}
              <div className="w-full h-24 bg-gradient-to-b from-black/90 to-transparent p-5 md:p-6 flex items-start justify-between pointer-events-auto">
                <div className="flex items-center gap-3">
                  {isFullscreen && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExitFullscreen();
                      }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer mr-1.5"
                    >
                      <ArrowLeft className="h-5.5 w-5.5" />
                    </button>
                  )}
                  <div>
                    {isTv && activeMedia.season != null && activeMedia.episode != null && (
                      <p className="text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-widest">
                        S{String(activeMedia.season).padStart(2, "0")} · E{String(activeMedia.episode).padStart(2, "0")}
                      </p>
                    )}
                    <h2 className="text-white text-base md:text-lg font-black leading-tight mt-0.5 drop-shadow-md max-w-sm line-clamp-1">
                      {activeMedia.title}
                    </h2>
                  </div>
                </div>
              </div>

              {/* MIDDLE ZONE: Center Action Buttons (Touch friendly) */}
              <div className="flex-1 flex items-center justify-center gap-10 md:gap-16 pointer-events-auto">
                {/* Skip Backward 10s */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                    revealControls();
                  }}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/45 hover:bg-black/60 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer shadow-lg"
                  title="Rewind 10 seconds"
                >
                  <RotateCcw className="h-5.5 w-5.5 md:h-6 md:w-6" />
                </button>

                {/* Big Center Play / Pause */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePlay();
                  }}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-600 hover:bg-red-500 border border-red-500/20 flex items-center justify-center text-white transition-all active:scale-95 cursor-pointer shadow-xl"
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8 fill-white" />
                  ) : (
                    <Play className="h-8 w-8 fill-white ml-1.5" />
                  )}
                </button>

                {/* Skip Forward 10s */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) videoRef.current.currentTime = Math.min(durationRef.current, videoRef.current.currentTime + 10);
                    revealControls();
                  }}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/45 hover:bg-black/60 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95 cursor-pointer shadow-lg"
                  title="Forward 10 seconds"
                >
                  <RotateCw className="h-5.5 w-5.5 md:h-6 md:w-6" />
                </button>
              </div>

              {/* Up Next Card overlay */}
              {hasNextEpisode && showNextCard && nextEpisode && (
                <div
                  className="absolute bottom-28 right-6 w-64 rounded-xl overflow-hidden border border-white/10 shadow-2xl pointer-events-auto"
                  style={{ background: "rgba(18,18,18,0.96)", backdropFilter: "blur(20px)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-3.5 space-y-3">
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Up Next</p>
                    <div className="flex gap-3 items-center">
                      {nextEpisode.posterUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={nextEpisode.posterUrl}
                          alt={nextEpisode.title}
                          className="w-12 h-[72px] object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {nextEpisode.season != null && nextEpisode.episode != null && (
                          <p className="text-white/40 text-[10px] font-bold">
                            S{String(nextEpisode.season).padStart(2,"0")} E{String(nextEpisode.episode).padStart(2,"0")}
                          </p>
                        )}
                        <p className="text-white text-xs font-bold leading-snug line-clamp-2 mt-0.5">
                          {nextEpisode.title}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={navigateToNext}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-white/90 transition-all cursor-pointer"
                    >
                      Play Next
                      <span className="text-black/40 font-medium">({countdown}s)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* BOTTOM FOOTER: Seekbar & Bottom Controls */}
              <div className="w-full bg-gradient-to-t from-black/95 to-transparent pt-10 pb-6 px-6 md:pb-8 md:px-8 space-y-4">
                
                {/* Seek Bar (Touch & Drag support) */}
                <div
                  ref={seekBarRef}
                  className="w-full group/seek h-6 flex items-center cursor-pointer pointer-events-auto relative"
                  onMouseDown={handleSeekMouseDown}
                  onTouchStart={handleTouchSeek}
                  onTouchMove={handleTouchSeek}
                  onTouchEnd={handleTouchEnd}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Track line (thicker for touch targets) */}
                  <div className="w-full h-1.5 md:h-1 group-hover/seek:h-[6px] bg-white/20 rounded-full transition-all duration-150 overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full relative"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {/* Drag Handle Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4.5 h-4.5 md:w-3.5 md:h-3.5 bg-red-600 border border-white rounded-full shadow-lg pointer-events-none transition-opacity duration-150"
                    style={{ left: `calc(${progress}% - 9px)` }}
                  />
                </div>

                {/* Bottom Control Actions */}
                <div className="w-full flex items-center justify-between gap-4 pointer-events-auto">
                  {/* Left Side: Volume & Time Tracker */}
                  <div className="flex items-center gap-4.5">
                    {/* Volume control */}
                    <div className="flex items-center gap-2 group/vol">
                      <button
                        onClick={handleToggleMute}
                        className="text-white/70 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="h-5.5 w-5.5" />
                        ) : (
                          <Volume2 className="h-5.5 w-5.5" />
                        )}
                      </button>
                      <input
                        type="range"
                        min={0} max={1} step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => { e.stopPropagation(); handleVolumeChange(parseFloat(e.target.value)); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-0 group-hover/vol:w-20 h-1 transition-all duration-250 accent-red-600 cursor-pointer bg-white/20 rounded-full"
                        style={{ outline: "none" }}
                      />
                    </div>

                    {/* Time Counter */}
                    <span className="text-white/75 text-xs font-mono tracking-tight select-none flex-shrink-0">
                      {formatTime(currentTime)}
                      <span className="text-white/25 mx-1.5 font-sans">/</span>
                      {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right Side: CC (always shown) · Audio (always shown) · Fullscreen */}
                  <div className="flex items-center gap-3">
                    {/* CC button (Subtitles) - Always displayed */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(m => m === "subs" ? null : "subs")}
                        className={`p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer bg-white/5 hover:bg-white/15 ${openMenu === "subs" ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}
                        title="Subtitles"
                      >
                        <Subtitles className="h-5 w-5" />
                      </button>
                      {openMenu === "subs" && (
                        <div
                          className="absolute bottom-12 right-0 w-48 rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50 animate-scale-in"
                          style={{ background: "rgba(18,18,18,0.96)", backdropFilter: "blur(20px)" }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-3 pt-3 pb-1 border-b border-white/5">
                            Subtitles
                          </p>
                          <div className="max-h-60 overflow-y-auto py-1">
                            {[
                              { language: "off", label: "Off" },
                              ...(activeMedia.subtitleTracks || []).map((t: SubtitleTrack) => ({
                                language: t.language,
                                label: formatLanguage(t.language),
                              })),
                            ].map((opt) => (
                              <button
                                key={opt.language}
                                onClick={() => { setSelectedSubtitle(opt.language); setOpenMenu(null); }}
                                className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors cursor-pointer ${
                                  selectedSubtitle === opt.language
                                    ? "bg-red-600/25 text-white font-bold"
                                    : "text-white/65 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AUDIO button (Audio track) - Always displayed */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(m => m === "audio" ? null : "audio")}
                        className={`p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer bg-white/5 hover:bg-white/15 ${openMenu === "audio" ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}
                        title="Audio Track"
                      >
                        <Languages className="h-5 w-5" />
                      </button>
                      {openMenu === "audio" && (
                        <div
                          className="absolute bottom-12 right-0 w-52 rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50 animate-scale-in"
                          style={{ background: "rgba(18,18,18,0.96)", backdropFilter: "blur(20px)" }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-3 pt-3 pb-1 border-b border-white/5">
                            Audio Track
                          </p>
                          <div className="max-h-60 overflow-y-auto py-1">
                            {[
                              { driveFileId: activeMedia.processedDriveFileId || activeMedia.driveFileId, language: "default" },
                              ...(activeMedia.audioVariants || [])
                            ].filter((v, idx, self) => self.findIndex(t => t.driveFileId === v.driveFileId) === idx)
                            .map((v) => (
                              <button
                                key={v.driveFileId}
                                onClick={() => handleAudioChange(v.driveFileId)}
                                className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors cursor-pointer ${
                                  selectedAudioVariant === v.driveFileId
                                    ? "bg-red-600/25 text-white font-bold"
                                    : "text-white/65 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {v.language === "default" ? "Default Audio" : formatLanguage(v.language)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fullscreen Toggle */}
                    <button
                      onClick={handleToggleFullscreen}
                      className="p-2 rounded-lg text-white/60 hover:text-white bg-white/5 hover:bg-white/15 transition-colors cursor-pointer"
                      title="Fullscreen (F)"
                    >
                      {isFullscreen ? (
                        <Minimize className="h-5 w-5" />
                      ) : (
                        <Maximize className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* External Players Section */}
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

          <div className="flex flex-wrap gap-x-6 gap-y-4 pt-1">
            {/* Android Options */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider pl-0.5">Android / Android TV</span>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`intent://${getAbsoluteStreamUrl().replace(/^https?:\/\//, "")}#Intent;package=com.brouken.player;scheme=https;type=video/*;end`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-500 border border-emerald-600/20 hover:bg-emerald-600/20 hover:text-emerald-400 transition-all text-xs font-semibold cursor-pointer active:scale-[0.97] duration-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Play in Just Player
                </a>
                <a
                  href={`vlc://${getAbsoluteStreamUrl()}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/10 text-orange-500 border border-orange-600/20 hover:bg-orange-600/20 hover:text-orange-400 transition-all text-xs font-semibold cursor-pointer active:scale-[0.97] duration-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Play in VLC (Android)
                </a>
              </div>
            </div>

            {/* Desktop Options */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider pl-0.5">Windows / macOS</span>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`mpv://${getAbsoluteStreamUrl()}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/10 text-rose-500 border border-rose-600/20 hover:bg-rose-600/20 hover:text-rose-400 transition-all text-xs font-semibold cursor-pointer active:scale-[0.97] duration-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Play in MPV (Windows)
                </a>
                <a
                  href={`iina://weblink?url=${encodeURIComponent(getAbsoluteStreamUrl())}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600/20 hover:text-indigo-300 transition-all text-xs font-semibold cursor-pointer active:scale-[0.97] duration-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Play in IINA (Mac)
                </a>
                <a
                  href={`${typeof window !== "undefined" ? window.location.origin : ""}/api/stream/${activeMedia.id}/${streamToken}/${userId}/playlist.m3u`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/10 text-orange-500 border border-orange-600/20 hover:bg-orange-600/20 hover:text-orange-400 transition-all text-xs font-semibold cursor-pointer active:scale-[0.97] duration-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Play in VLC / PotPlayer (M3U)
                </a>
              </div>
            </div>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20 hover:text-emerald-300 transition-all text-xs font-semibold cursor-pointer"
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5" />Copied Link!</>
              ) : (
                <><Copy className="h-3.5 w-3.5" />Copy Stream Link</>
              )}
            </button>
          </div>

          <p className="text-[10px] text-foreground/30 mt-2 font-medium leading-relaxed">
            💡 <strong>Tip:</strong> Clicking <strong>Play in Desktop Player</strong> downloads a temporary playlist file. Open this file to start playback instantly inside your default media player (VLC/PotPlayer).
          </p>
        </div>
      )}
    </div>
  );
}
