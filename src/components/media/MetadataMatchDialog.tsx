"use client";

import { useState } from "react";
import { Search, X, Check, Film, Tv, Loader2 } from "lucide-react";

interface TmdbResult {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string;
}

interface MetadataMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** For a single movie: pass its mediaId */
  mediaId?: string;
  /** For a TV show series: pass the series name */
  seriesName?: string;
  /** Default search type */
  defaultType?: "movie" | "tv";
  onSuccess?: () => void;
}

export function MetadataMatchDialog({
  isOpen,
  onClose,
  mediaId,
  seriesName,
  defaultType = "tv",
  onSuccess,
}: MetadataMatchDialogProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"movie" | "tv">(defaultType);
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [matching, setMatching] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/metadata/search?query=${encodeURIComponent(query)}&type=${type}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleMatch = async (tmdbId: number) => {
    setMatching(tmdbId);
    setError(null);
    try {
      const body: Record<string, unknown> = { tmdbId, type };
      if (type === "movie" && mediaId) body.mediaId = mediaId;
      if (type === "tv" && seriesName) body.seriesName = seriesName;

      const res = await fetch("/api/metadata/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Match failed");
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match failed");
    } finally {
      setMatching(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#141414] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Metadata</h2>
            {seriesName && <p className="text-sm text-white/50 mt-0.5">Series: {seriesName}</p>}
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setType("movie")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                type === "movie"
                  ? "bg-brand-primary border-brand-primary text-white"
                  : "border-white/20 text-white/60 hover:text-white hover:border-white/40"
              }`}
            >
              <Film className="h-3.5 w-3.5" /> Movie
            </button>
            <button
              onClick={() => setType("tv")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                type === "tv"
                  ? "bg-brand-primary border-brand-primary text-white"
                  : "border-white/20 text-white/60 hover:text-white hover:border-white/40"
              }`}
            >
              <Tv className="h-3.5 w-3.5" /> TV / Anime
            </button>
          </div>

          {/* Search Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search TMDB..."
              className="flex-1 bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-brand-primary/60 transition-colors"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="px-4 py-2.5 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{error}</p>
          )}

          {success && (
            <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 flex items-center gap-2">
              <Check className="h-4 w-4" /> Metadata updated successfully! Refreshing...
            </p>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-none">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {result.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                      alt={result.title}
                      className="h-16 w-11 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-11 rounded-lg bg-white/10 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm line-clamp-1">{result.title}</p>
                    <p className="text-white/40 text-xs mt-0.5">{result.releaseDate ? result.releaseDate.slice(0, 4) : "Unknown year"}</p>
                    <p className="text-white/50 text-xs mt-1 line-clamp-2">{result.overview}</p>
                  </div>
                  <button
                    onClick={() => handleMatch(result.id)}
                    disabled={matching !== null}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-medium hover:bg-brand-primary/90 disabled:opacity-50 cursor-pointer transition-all"
                  >
                    {matching === result.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Match
                  </button>
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && !searching && query && (
            <p className="text-sm text-white/40 text-center py-4">No results found. Try a different search term.</p>
          )}
        </div>
      </div>
    </div>
  );
}
