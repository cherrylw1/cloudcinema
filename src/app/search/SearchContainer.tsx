"use client";

import { useState } from "react";
import type { Media } from "@/repositories/media";
import { SearchBar } from "./SearchBar";
import { PaginatedMediaGrid } from "@/components/media/PaginatedMediaGrid";
import { SeriesCard } from "@/components/media/SeriesCard";
import { Sparkles, Search, MessageSquareCode } from "lucide-react";

interface SearchContainerProps {
  initialMedia: Media[];
  query: string;
}

interface CineMatchResult {
  id: string;
  title: string;
  reason: string;
  media?: Media; // Resolved media object
}

export function SearchContainer({ initialMedia, query }: SearchContainerProps) {
  const [mode, setMode] = useState<"keyword" | "cinematch">("keyword");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<CineMatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cinematch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch recommendations from CineMatch");
      }

      const data = await res.json();
      const results: CineMatchResult[] = data.results || [];
      setAiResults(results);
    } catch (err: any) {
      console.error("[CineMatch Error]", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Selector Toggle Tab */}
      <div className="flex justify-center mb-2">
        <div 
          className="flex p-1 rounded-2xl border border-white/[0.08] backdrop-blur-xl bg-white/[0.03]"
          style={{ width: "fit-content" }}
        >
          <button
            onClick={() => setMode("keyword")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
              mode === "keyword"
                ? "bg-white/[0.08] text-white border border-white/[0.1] shadow-lg"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            Standard Search
          </button>
          <button
            onClick={() => setMode("cinematch")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
              mode === "cinematch"
                ? "bg-brand-primary text-white shadow-lg glow-accent"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 fill-current" />
            AI CineMatch Assistant
          </button>
        </div>
      </div>

      {mode === "keyword" ? (
        <div className="space-y-6 animate-fade-in">
          <SearchBar initialQuery={query} />
          <PaginatedMediaGrid
            key={query}
            initialMedia={initialMedia}
            query={query}
            emptyStateMessage={
              query
                ? `No results for '${query}'.`
                : "Type a query in the search bar to look up movies or TV series."
            }
          />
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
          {/* AI Prompt Form */}
          <form onSubmit={handleAiSubmit} className="relative w-full">
            <input
              type="text"
              placeholder="Ask CineMatch... (e.g. 'a cozy anime series', 'something like Inception under 2 hours')"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              disabled={loading}
              className="w-full rounded-2xl py-3.5 pr-28 pl-6 text-sm text-white bg-white/[0.03] border border-white/[0.08] placeholder-white/30 outline-none transition-all duration-200 focus:border-brand-primary/50 focus:bg-white/[0.05]"
              style={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            />
            <button
              type="submit"
              disabled={loading || !aiQuery.trim()}
              className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-md hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 fill-current" />
              Match
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && (
            <div className="space-y-4">
              <div className="flex gap-2 items-center text-xs text-white/40 animate-pulse pl-1">
                <Sparkles className="h-3.5 w-3.5 fill-current animate-spin text-brand-primary" />
                CineMatch is analyzing your library and watch tastes...
              </div>
              <div className="space-y-3.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div 
                    key={`ai-skeleton-${i}`} 
                    className="flex gap-4 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse"
                  >
                    <div className="w-24 aspect-[2/3] rounded-xl bg-white/[0.04]" />
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-4 w-1/3 rounded bg-white/[0.05]" />
                      <div className="h-3.5 w-full rounded bg-white/[0.03]" />
                      <div className="h-3.5 w-5/6 rounded bg-white/[0.03]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results List */}
          {!loading && aiResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-1.5 items-center text-xs font-bold uppercase tracking-wider text-brand-primary pl-1">
                <Sparkles className="h-3.5 w-3.5 fill-current" />
                CineMatch Recommendations
              </div>

              <div className="space-y-3.5">
                {aiResults.map((result, idx) => (
                  <div 
                    key={`cinematch-row-${idx}`}
                    className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04] transition-all duration-200"
                  >
                    {/* Media Card Container */}
                    <div className="w-24 flex-shrink-0 mx-auto md:mx-0">
                      {result.media && (
                        <SeriesCard media={result.media} horizontal={true} />
                      )}
                    </div>

                    {/* AI Recommendation Context */}
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <h4 className="text-base font-bold text-white mb-1.5 text-center md:text-left">
                        {result.media?.series || result.media?.title}
                      </h4>
                      <p className="text-white/60 text-xs leading-relaxed line-clamp-3 mb-3 text-center md:text-left">
                        {result.media?.overview}
                      </p>
                      
                      {/* CineMatch Note bubble */}
                      <div className="flex gap-2 p-3 rounded-xl border border-brand-primary/10 bg-brand-primary/[0.02] text-xs leading-relaxed text-white/80">
                        <MessageSquareCode className="h-4 w-4 text-brand-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-brand-primary mr-1">CineMatch:</span>
                          {result.reason}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty Prompt State */}
          {!loading && aiResults.length === 0 && !error && (
            <div className="text-center py-20 space-y-3 border border-dashed border-white/[0.08] rounded-2xl">
              <div className="text-4xl text-white/30">🤖</div>
              <h4 className="text-sm font-semibold text-white/60">Your AI CineMatch concierge</h4>
              <p className="text-xs text-white/35 max-w-sm mx-auto leading-relaxed">
                Describe the specific mood, genre, runtime, or themes you want. CineMatch will analyze your entire Google Drive library to find the perfect match.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
