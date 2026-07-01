import { createClient } from "@/clients/supabase/server";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { MovieDetailActions } from "./MovieDetailActions";

interface MoviePageProps {
  params: Promise<{
    id: string;
  }>;
}

function formatRuntime(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(2)} GB`;
}

export default async function MovieDetailsPage({ params }: MoviePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch the movie record matching id
  const { data: movie, error } = await supabase
    .from("media_library")
    .select("*")
    .eq("id", id)
    .eq("media_type", "movie")
    .maybeSingle();

  if (error || !movie) {
    notFound();
  }

  // Check if this movie is currently in the user's watchlist
  const { data: { user } } = await supabase.auth.getUser();
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

  // Extract year and clean title
  const yearMatch = movie.title.match(/\((\d{4})\)/);
  const displayYear = yearMatch ? yearMatch[1] : new Date(movie.created_at).getFullYear().toString();
  const displayTitle = movie.title.replace(/\s*\(\d{4}\)/, "").trim();

  const formattedRuntime = formatRuntime(movie.runtime);
  const formattedFileSize = formatFileSize(movie.file_size);

  return (
    <div className="-mx-6 md:-mx-8 -mt-6 md:-mt-8 min-h-screen bg-black text-white relative">
      {/* Immersive Backdrop Image */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        {movie.backdrop_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.backdrop_url}
            alt={displayTitle}
            className="w-full h-full object-cover opacity-60 md:opacity-50"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
        )}
        
        {/* Sleek Cinematic Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      </div>

      {/* Floating Header Navigation */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-white/80 hover:text-white transition-all text-sm backdrop-blur-md cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Browse
        </Link>
      </div>

      {/* Hero Content Overlay */}
      <div className="relative z-10 min-h-screen flex flex-col justify-end px-6 md:px-12 pb-16 md:pb-24 pt-24 max-w-5xl">
        <div className="flex flex-col md:flex-row gap-8 items-end">
          {/* Movie Poster (visible on desktop) */}
          {movie.poster_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.poster_url}
              alt={displayTitle}
              className="hidden md:block w-48 h-72 object-cover rounded-2xl shadow-2xl border border-white/15 flex-shrink-0 transition-transform duration-500 hover:scale-[1.02]"
            />
          )}

          {/* Text Metadata Details */}
          <div className="flex-1 space-y-4">
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight drop-shadow-2xl">
              {displayTitle}
            </h1>

            {/* Badges / Specifications Row */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-white/80 font-medium">
              {/* Year */}
              <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/5 backdrop-blur-sm">
                {displayYear}
              </span>
              
              {/* Rating Placeholder */}
              <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/5 backdrop-blur-sm">
                PG-13
              </span>

              {/* Formatted Runtime */}
              {formattedRuntime && (
                <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/5 backdrop-blur-sm">
                  {formattedRuntime}
                </span>
              )}

              {/* Formatted File Size */}
              {formattedFileSize && (
                <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/5 backdrop-blur-sm">
                  {formattedFileSize}
                </span>
              )}

              {/* Quality badge: 4K if file size is large, else HD */}
              <span className="bg-brand-primary/15 text-brand-primary border border-brand-primary/30 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider backdrop-blur-sm">
                {movie.file_size && movie.file_size > 15 * 1024 * 1024 * 1024 ? "4K UHD" : "1080p HD"}
              </span>

              {/* Audio spec badge */}
              {movie.audio_codec && (
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider backdrop-blur-sm">
                  {movie.audio_codec.toUpperCase()}
                </span>
              )}

              {/* Video spec badge: Dolby Vision */}
              {movie.dv_profile !== null && movie.dv_profile !== undefined && (
                <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider backdrop-blur-sm">
                  DV Profile {movie.dv_profile}
                </span>
              )}
            </div>

            {/* Overview / Plot Summary */}
            {movie.overview ? (
              <p className="text-white/85 text-base md:text-lg max-w-2xl leading-relaxed drop-shadow-md">
                {movie.overview}
              </p>
            ) : (
              <p className="text-white/40 italic text-sm">
                No plot overview is currently available for this movie.
              </p>
            )}

            {/* Action Buttons (Play, Watchlist Toggle, Edit Metadata) */}
            <div className="pt-2">
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
