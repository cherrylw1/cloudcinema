"use client";

import { useEffect, useState } from "react";
import { Sparkles, Clapperboard, Film } from "lucide-react";

interface AnalysisData {
  fit: string;
  trivia: string[];
}

interface MediaAnalysisPanelProps {
  mediaId: string;
}

export function MediaAnalysisPanel({ mediaId }: MediaAnalysisPanelProps) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    fetch(`/api/media/${mediaId}/analysis`)
      .then((res) => {
        if (!res.ok) throw new Error("Analysis failed");
        return res.json();
      })
      .then((analysis) => {
        if (active && analysis && analysis.fit) {
          setData(analysis);
        }
      })
      .catch((err) => {
        console.warn("[MediaAnalysis] Failed to load metadata analysis:", err);
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mediaId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse p-5 rounded-2xl border border-white/[0.05] bg-white/[0.02]">
        <div className="flex gap-2 items-center text-xs text-white/30">
          <Sparkles className="h-3.5 w-3.5 fill-current animate-spin text-brand-primary/50" />
          Analyzing how this matches your taste...
        </div>
        <div className="h-4 w-1/3 rounded bg-white/[0.05]" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-white/[0.03]" />
          <div className="h-3 w-5/6 rounded bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  // If there's an error (e.g. no OpenRouter key), we hide the panel cleanly so there's no UI clutter
  if (error || !data) {
    return null;
  }

  return (
    <div className="space-y-5 p-5 sm:p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
      {/* Title Header */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-primary">
        <Sparkles className="h-4 w-4 fill-current" />
        AI Taste Fit & trivia
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Taste Fit Column */}
        <div className="space-y-3.5">
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Film className="h-4 w-4 text-brand-primary" />
            Why You&apos;ll Love It
          </h4>
          <p className="text-white/70 text-xs sm:text-sm leading-relaxed border-l-2 border-brand-primary/30 pl-4 py-0.5">
            {data.fit}
          </p>
        </div>

        {/* Trivia Column */}
        {data.trivia && data.trivia.length > 0 && (
          <div className="space-y-3.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Clapperboard className="h-4 w-4 text-brand-primary" />
              Behind the Lens
            </h4>
            <ul className="space-y-2.5">
              {data.trivia.map((item, idx) => (
                <li 
                  key={`trivia-${idx}`}
                  className="flex gap-2 text-xs sm:text-[13px] leading-relaxed text-white/65"
                >
                  <span className="text-brand-primary font-bold select-none">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
