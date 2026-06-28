"use client";

import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    scanned: number;
    added: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        });
      } else {
        setError(data.error || "An error occurred during library synchronization.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger sync.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <PageContainer
      title="Settings"
      description="Manage your account, libraries, and application preferences."
    >
      <div className="space-y-6">
        <GlassPanel className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Media Synchronization</h3>
              <p className="text-xs text-foreground/60">
                Scan your Google Drive folder and sync movies and shows to the local database catalog.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 h-10 px-5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl transition-all duration-200 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Library"}
            </Button>
          </div>

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
        </GlassPanel>
      </div>
    </PageContainer>
  );
}
