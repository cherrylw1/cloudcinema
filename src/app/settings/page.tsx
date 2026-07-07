"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw, AlertCircle, CheckCircle2, Film, Laptop, Smartphone, Download, ExternalLink } from "lucide-react";
import { getMediaStatsAction } from "@/server/actions/media-actions";

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    scanned: number;
    added: number;
    updated: number;
    skipped: number;
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [metaSyncing, setMetaSyncing] = useState(false);
  const [metaResult, setMetaResult] = useState<{
    processed: number;
    matched: number;
    unmatched: number;
    reclassifiedAnime: number;
    message?: string;
  } | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [embedSyncing, setEmbedSyncing] = useState(false);
  const [embedResult, setEmbedResult] = useState<{
    processed: number;
    remaining: number;
    message: string;
  } | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);

  const [stats, setStats] = useState<{ dv5Count: number; dv78Count: number } | null>(null);

  const fetchStats = async () => {
    try {
      const data = await getMediaStatsAction();
      setStats(data);
    } catch (err) {
      console.error("Failed to load Dolby Vision stats:", err);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchStats();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setResult({
          scanned: data.scanned ?? 0,
          added: data.added ?? 0,
          updated: data.updated ?? 0,
          skipped: data.skipped ?? 0,
          message: data.message,
        });
        await fetchStats(); // Refresh stats after sync
      } else {
        setError(data.error || "An error occurred during library synchronization.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger sync.");
    } finally {
      setSyncing(false);
    }
  };

  const handleFetchMetadata = async () => {
    setMetaSyncing(true);
    setMetaError(null);
    setMetaResult(null);

    try {
      const res = await fetch("/api/metadata-sync", { method: "POST" });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setMetaResult({
          processed: data.processed ?? 0,
          matched: data.matched ?? 0,
          unmatched: data.unmatched ?? 0,
          reclassifiedAnime: data.reclassifiedAnime ?? 0,
          message: data.message,
        });
        await fetchStats(); // Refresh stats after metadata sync
      } else {
        setMetaError(data.error || "An error occurred during metadata synchronization.");
      }
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : "Failed to trigger metadata sync.");
    } finally {
      setMetaSyncing(false);
    }
  };

  const handleGenerateEmbeddings = async () => {
    setEmbedSyncing(true);
    setEmbedError(null);
    setEmbedResult(null);

    try {
      const res = await fetch("/api/admin/embed", { method: "POST" });
      const data = await res.json();
      
      if (res.ok) {
        setEmbedResult({
          processed: data.processed ?? 0,
          remaining: data.remaining ?? 0,
          message: data.message || "",
        });
      } else {
        setEmbedError(data.error || "An error occurred during embedding generation.");
      }
    } catch (err) {
      setEmbedError(err instanceof Error ? err.message : "Failed to trigger embedding worker.");
    } finally {
      setEmbedSyncing(false);
    }
  };

  return (
    <PageContainer
      title="Settings"
      description="Manage your account, libraries, and application preferences."
    >
      <div className="space-y-6">
        <GlassPanel className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Media Sync & Metadata</h3>
              <p className="text-xs text-foreground/60">
                Sync movies and shows from Google Drive, and fetch canonical metadata from TMDB.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <Button
              onClick={handleSync}
              disabled={syncing || metaSyncing}
              className="flex items-center gap-2 h-10 px-5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl transition-all duration-200 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Library"}
            </Button>

            <Button
              onClick={handleFetchMetadata}
              disabled={syncing || metaSyncing || embedSyncing}
              className="flex items-center gap-2 h-10 px-5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all duration-200 cursor-pointer"
            >
              <Film className={`h-4 w-4 ${metaSyncing ? "animate-pulse" : ""}`} />
              {metaSyncing ? "Fetching..." : "Fetch Metadata"}
            </Button>

            <Button
              onClick={handleGenerateEmbeddings}
              disabled={syncing || metaSyncing || embedSyncing}
              className="flex items-center gap-2 h-10 px-5 bg-teal-600 hover:bg-teal-750 text-white rounded-xl transition-all duration-200 cursor-pointer"
            >
              <Database className={`h-4 w-4 ${embedSyncing ? "animate-spin" : ""}`} />
              {embedSyncing ? "Embedding..." : "Generate AI Embeddings"}
            </Button>
          </div>

          {/* Dolby Vision Stats Display */}
          {stats && (
            <div className="bg-card/25 border border-border/40 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Dolby Vision Content Status</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-card/30 border border-border/30 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="block text-xs text-foreground/50">Profile 5 (Unsupported)</span>
                    <span className="text-lg font-bold text-red-500">{stats.dv5Count}</span>
                  </div>
                  <span className="text-[10px] text-red-500/80 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 font-medium">Transcoding Required</span>
                </div>
                <div className="bg-card/30 border border-border/30 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="block text-xs text-foreground/50">Profile 7 / 8 (Supported)</span>
                    <span className="text-lg font-bold text-green-500">{stats.dv78Count}</span>
                  </div>
                  <span className="text-[10px] text-green-500/80 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 font-medium">On-the-fly Extractable</span>
                </div>
              </div>
            </div>
          )}

          {/* Sync Results */}
          {error && (
            <div className="flex items-start gap-2.5 text-sm text-red-500 bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Synchronization Failed</p>
                <p className="text-xs opacity-90">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="flex items-start gap-2.5 text-sm text-green-500 bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-2 w-full">
                <p className="font-medium">Sync Complete</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 text-foreground">
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold">{result.scanned}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Scanned</span>
                  </div>
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold text-green-500">{result.added}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Added</span>
                  </div>
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold text-blue-500">{result.updated}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Updated</span>
                  </div>
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold text-foreground/50">{result.skipped}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Skipped</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Metadata Results */}
          {metaError && (
            <div className="flex items-start gap-2.5 text-sm text-red-500 bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Metadata Fetch Failed</p>
                <p className="text-xs opacity-90">{metaError}</p>
              </div>
            </div>
          )}

          {metaResult && (
            <div className="flex items-start gap-2.5 text-sm text-purple-500 bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-2 w-full">
                <p className="font-medium">Metadata Sync Complete</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 text-foreground">
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold">{metaResult.processed}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Processed</span>
                  </div>
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold text-green-500">{metaResult.matched}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Matched</span>
                  </div>
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold text-red-500">{metaResult.unmatched}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Unmatched</span>
                  </div>
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold text-purple-500">{metaResult.reclassifiedAnime}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Anime Reclassified</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Embedding Results */}
          {embedError && (
            <div className="flex items-start gap-2.5 text-sm text-red-500 bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Embedding Generation Failed</p>
                <p className="text-xs opacity-90">{embedError}</p>
              </div>
            </div>
          )}

          {embedResult && (
            <div className="flex items-start gap-2.5 text-sm text-teal-500 bg-teal-500/10 border border-teal-500/20 p-4 rounded-xl animate-fade-in">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-2 w-full">
                <p className="font-medium">AI Embeddings Sync Complete</p>
                <p className="text-xs text-foreground/80">{embedResult.message}</p>
                <div className="grid grid-cols-2 gap-4 pt-1 text-foreground">
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold text-teal-400">{embedResult.processed}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Processed This Batch</span>
                  </div>
                  <div className="bg-card/40 border border-border/55 p-3 rounded-lg text-center">
                    <span className="block text-xl font-bold text-foreground/50">{embedResult.remaining}</span>
                    <span className="text-[10px] text-foreground/50 uppercase tracking-wider">Remaining Unembedded</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">External Player Integrations</h3>
              <p className="text-xs text-foreground/60">
                Configure modern, high-performance external players for Windows, Android, and TV.
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-white/[0.06]" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Windows Configuration */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Laptop className="h-4.5 w-4.5 text-rose-500" />
                <h4 className="text-sm font-semibold text-foreground">Windows: Play in MPV (One-Click)</h4>
              </div>
              <p className="text-xs text-foreground/60 leading-relaxed">
                Replicate the seamless macOS + IINA experience on Windows. Using our custom handler, clicking the <strong>Play in MPV</strong> button will instantly launch the lightweight, GPU-accelerated MPV player without downloading playlist files.
              </p>
              
              <div className="bg-card/25 border border-border/40 p-4 rounded-xl space-y-2">
                <h5 className="text-[11px] uppercase tracking-wider font-semibold text-foreground/50">One-Time Setup:</h5>
                <ol className="text-xs text-foreground/75 list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>Download the lightweight <a href="https://github.com/shinchiro/mpv-winbuild-cmake/releases" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:underline font-semibold font-mono">mpv player for Windows</a> (download the standard build starting with <code>mpv-x86_64-</code> under Assets, <strong>not</strong> the dev build starting with <code>mpv-dev-</code>) and extract it.</li>
                  <li>Download our <a href="/setup-mpv.bat" download className="text-rose-400 hover:underline font-semibold flex inline-flex items-center gap-1">setup-mpv.bat <Download className="h-3 w-3" /></a> script.</li>
                  <li>Place the script inside the extracted <code>mpv</code> folder.</li>
                  <li>Double-click the <strong>setup-mpv.bat</strong> file to run it. Done!</li>
                </ol>
              </div>
            </div>

            {/* Android Configuration */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4.5 w-4.5 text-emerald-500" />
                <h4 className="text-sm font-semibold text-foreground">Android & TV: Play in Just Player</h4>
              </div>
              <p className="text-xs text-foreground/60 leading-relaxed">
                VLC often suffers from buffering or hardware decoding lag on mobile. For buttery-smooth 120Hz playback on Android phones and TV, we recommend <strong>Just Player</strong>, an ad-free, lightweight player built on Google's native ExoPlayer library.
              </p>

              <div className="bg-card/25 border border-border/40 p-4 rounded-xl space-y-2">
                <h5 className="text-[11px] uppercase tracking-wider font-semibold text-foreground/50">One-Time Setup:</h5>
                <ol className="text-xs text-foreground/75 list-decimal list-inside space-y-1.5 leading-relaxed">
                  <li>Download and install <a href="https://play.google.com/store/apps/details?id=com.brouken.player" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-semibold inline-flex items-center gap-1">Just Player from Google Play <ExternalLink className="h-3 w-3" /></a> on your phone or Android TV.</li>
                  <li>Open the movie details, and click <strong>Play in Just Player (Android)</strong>.</li>
                  <li>The app will automatically launch the player and buffer the stream seamlessly!</li>
                </ol>
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>
    </PageContainer>
  );
}
