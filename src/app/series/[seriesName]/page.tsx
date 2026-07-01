import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/clients/supabase/server";
import { Play, ChevronLeft } from "lucide-react";
import { SeriesDetailClient } from "./SeriesDetailClient";
import { EpisodeRow } from "./EpisodeRow";

interface SeriesPageProps {
  params: Promise<{ seriesName: string }>;
}

function formatRuntime(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  return `${gb.toFixed(2)} GB`;
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { seriesName } = await params;
  const decoded = decodeURIComponent(seriesName);

  const supabase = await createClient();

  const { data: episodes, error } = await supabase
    .from("media_library")
    .select("*")
    .or(`series.eq."${decoded}",title.eq."${decoded}"`)
    .order("season", { ascending: true })
    .order("episode", { ascending: true });

  if (error || !episodes || episodes.length === 0) notFound();

  const showMeta = episodes[0];
  const backdropUrl = showMeta.backdrop_url;
  const posterUrl = showMeta.poster_url;
  const overview = showMeta.overview;
  const displayTitle = showMeta.series || showMeta.title;

  const seasonMap: Record<number, typeof episodes> = {};
  for (const ep of episodes) {
    const s = ep.season ?? 1;
    if (!seasonMap[s]) seasonMap[s] = [];
    seasonMap[s].push(ep);
  }
  const seasons = Object.keys(seasonMap)
    .map(Number)
    .sort((a, b) => a - b);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const progressMap: Record<string, { position: number; completed: boolean }> = {};
  let isInWatchlist = false;

  if (user) {
    const mediaIds = episodes.map((e) => e.id);
    const { data: progress } = await supabase
      .from("user_progress")
      .select("media_id, playback_position, completed")
      .eq("profile_id", user.id)
      .in("media_id", mediaIds);
    for (const p of progress || []) {
      progressMap[p.media_id] = { position: p.playback_position, completed: p.completed };
    }

    const { data: watchlistEntry } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("media_id", showMeta.id)
      .maybeSingle();
    isInWatchlist = !!watchlistEntry;
  }

  const firstUnwatched =
    episodes.find((ep) => !progressMap[ep.id]?.completed) || episodes[0];

  return (
    <div className="min-h-screen text-white" style={{ background: "#08080f" }}>
      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="relative w-full" style={{ height: "62vh", minHeight: "420px" }}>
        {backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropUrl}
            alt={displayTitle}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.4 }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 60% 20%, rgba(99,102,241,0.12) 0%, transparent 60%)",
            }}
          />
        )}

        {/* Gradient layers */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(8,8,15,0.96) 0%, rgba(8,8,15,0.65) 50%, rgba(8,8,15,0.1) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(8,8,15,1) 0%, rgba(8,8,15,0.4) 40%, transparent 70%)",
          }}
        />

        {/* Back button */}
        <div className="absolute top-6 left-6 z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white/75 hover:text-white transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            Browse
          </Link>
        </div>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 md:p-14 z-10">
          <div className="flex gap-4 sm:gap-7 items-end max-w-5xl">
            {posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrl}
                alt={displayTitle}
                className="hidden md:block w-36 h-[216px] object-cover flex-shrink-0"
                style={{
                  borderRadius: "16px",
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxShadow: "0 24px 60px -12px rgba(0,0,0,0.8)",
                }}
              />
            )}
            <div className="flex-1 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    showMeta.media_type === "anime"
                      ? "bg-purple-500/80 text-white"
                      : "bg-blue-500/80 text-white"
                  }`}
                >
                  {showMeta.media_type === "anime" ? "Anime" : "TV Show"}
                </span>
                <span className="text-white/40 text-xs">
                  {episodes.length} Episode{episodes.length !== 1 ? "s" : ""}
                </span>
              </div>
              <h1
                className="text-3xl md:text-5xl font-black text-white leading-[1.05] tracking-[-0.03em] drop-shadow-2xl"
              >
                {displayTitle}
              </h1>
              {overview && (
                <p className="text-white/65 text-sm md:text-[15px] max-w-xl leading-relaxed line-clamp-2">
                  {overview}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-1">
                <Link
                  href={`/watch/${firstUnwatched.id}`}
                  className="inline-flex items-center gap-2 px-5 sm:px-7 py-2.5 rounded-2xl text-sm font-bold text-black hover:opacity-90 transition-all duration-200 shadow-lg animate-scale-in"
                  style={{
                    background: "rgba(255,255,255,0.95)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  }}
                >
                  <Play className="h-4 w-4 fill-black" />
                  Play
                </Link>
                <SeriesDetailClient
                  seriesName={decoded}
                  defaultType={showMeta.media_type === "movie" ? "movie" : "tv"}
                  mediaId={showMeta.id}
                  initialInWatchlist={isInWatchlist}
                  userId={user?.id || null}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Episodes ──────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 md:px-14 py-8 space-y-8">
        {seasons.map((season) => (
          <div key={season} className="space-y-3">
            {seasons.length > 1 && (
              <h2
                className="text-base font-semibold text-white/70 tracking-[-0.01em] pb-2"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
              >
                Season {season}
              </h2>
            )}
            <div className="space-y-2">
              {seasonMap[season].map((ep) => {
                const prog = progressMap[ep.id];
                const runtime = ep.runtime;
                const progressPct =
                  prog && runtime && runtime > 0
                    ? Math.min(100, (prog.position / runtime) * 100)
                    : 0;

                return (
                  <EpisodeRow
                    key={ep.id}
                    ep={ep}
                    progressPct={progressPct}
                    completed={prog?.completed ?? false}
                    runtimeStr={formatRuntime(runtime)}
                    fileSizeStr={formatFileSize(ep.file_size)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
