import { createClient } from "@/clients/supabase/server";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { MovieDetailActions } from "./MovieDetailActions";

interface MoviePageProps {
  params: Promise<{ id: string }>;
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

export default async function MovieDetailsPage({ params }: MoviePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: movie, error } = await supabase
    .from("media_library")
    .select("*")
    .eq("id", id)
    .eq("media_type", "movie")
    .maybeSingle();

  if (error || !movie) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isInWatchlist = false;

  if (user) {
    const { data: watchlistEntry } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("media_id", movie.id)
      .maybeSingle();
    isInWatchlist = !!watchlistEntry;
  }

  const yearMatch = movie.title.match(/(\d{4})/);
  const displayYear = yearMatch ? yearMatch[1] : new Date(movie.created_at).getFullYear().toString();
  const displayTitle = movie.title.replace(/\s*\(\d{4}\)/, "").trim();

  const formattedRuntime = formatRuntime(movie.runtime);
  const formattedFileSize = formatFileSize(movie.file_size);

  return (
    <div className="-mx-6 md:-mx-8 -mt-6 md:-mt-8 min-h-screen text-white relative overflow-hidden"
      style={{ background: "#08080f" }}
    >
      {/* Full-bleed backdrop */}
      <div className="absolute inset-0 w-full h-full">
        {movie.backdrop_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.backdrop_url}
            alt={displayTitle}
            className="w-full h-full object-cover"
            style={{ opacity: 0.35 }}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 60% 30%, rgba(99,102,241,0.12) 0%, transparent 60%)",
            }}
          />
        )}

        {/* Cinematic gradient layers */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(8,8,15,0.98) 0%, rgba(8,8,15,0.80) 40%, rgba(8,8,15,0.30) 80%, rgba(8,8,15,0.10) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(8,8,15,1) 0%, rgba(8,8,15,0.5) 30%, transparent 60%)",
          }}
        />
        {/* Vignette edges */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(8,8,15,0.7) 100%)",
          }}
        />
      </div>

      {/* Floating back button */}
      <div className="absolute top-6 left-6 z-20">
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

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col justify-end px-4 sm:px-6 md:px-16 pb-24 md:pb-24 pt-24">
        <div className="max-w-5xl flex flex-col md:flex-row gap-6 md:gap-10 items-end">
          {/* Poster — desktop only */}
          {movie.poster_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.poster_url}
              alt={displayTitle}
              className="hidden md:block w-52 h-[312px] object-cover flex-shrink-0 transition-transform duration-500 hover:scale-[1.02] hover:shadow-2xl"
              style={{
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 32px 80px -16px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            />
          )}

          {/* Info panel — frosted glass */}
          <div
            className="w-full flex-1 p-4 sm:p-8 space-y-4 sm:space-y-5 animate-slide-up"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "24px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* Title */}
            <h1
              className="text-3xl md:text-5xl font-black text-white leading-[1.05] tracking-[-0.03em]"
            >
              {displayTitle}
            </h1>

            {/* Metadata badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-xs font-medium px-3 py-1 rounded-full text-white/75"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {displayYear}
              </span>

              {formattedRuntime && (
                <span
                  className="text-xs font-medium px-3 py-1 rounded-full text-white/75"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {formattedRuntime}
                </span>
              )}

              {formattedFileSize && (
                <span
                  className="text-xs font-medium px-3 py-1 rounded-full text-white/75"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {formattedFileSize}
                </span>
              )}

              {/* Quality badge */}
              <span
                className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                style={{
                  background: "rgba(229,9,20,0.15)",
                  border: "1px solid rgba(229,9,20,0.3)",
                  color: "#ff6b6b",
                }}
              >
                {movie.file_size && movie.file_size > 15 * 1024 * 1024 * 1024 ? "4K UHD" : "1080p"}
              </span>

              {movie.audio_codec && (
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                  style={{
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    color: "#818cf8",
                  }}
                >
                  {movie.audio_codec.toUpperCase()}
                </span>
              )}

              {movie.dv_profile !== null && movie.dv_profile !== undefined && (
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                  style={{
                    background: "rgba(168,85,247,0.12)",
                    border: "1px solid rgba(168,85,247,0.25)",
                    color: "#c084fc",
                  }}
                >
                  Dolby Vision
                </span>
              )}
            </div>

            {/* Overview */}
            {movie.overview ? (
              <p className="text-white/70 text-sm md:text-[15px] max-w-2xl leading-relaxed">
                {movie.overview}
              </p>
            ) : (
              <p className="text-white/30 italic text-sm">
                No overview available.
              </p>
            )}

            {/* Actions */}
            <div className="pt-1">
              <MovieDetailActions
                mediaId={movie.id}
                initialInWatchlist={isInWatchlist}
                userId={user?.id || null}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
