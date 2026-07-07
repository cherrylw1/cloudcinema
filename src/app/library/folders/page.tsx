"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { SeriesCard } from "@/components/media/SeriesCard";
import { Folder, ArrowLeft, Loader2, Info } from "lucide-react";
import type { Media } from "@/repositories/media";

interface FolderContent {
  currentPath: string;
  folders: string[];
  files: Media[];
}

function FoldersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathParam = searchParams.get("path") || "/";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FolderContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/folders?path=${encodeURIComponent(pathParam)}`)
      .then((res) => res.json())
      .then((resData) => {
        if (!active) return;
        if (resData.success) {
          setData(resData);
        } else {
          setError(resData.error || "Failed to load folder contents.");
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error("[FoldersPage] Error fetching:", err);
        setError("Failed to fetch folder contents.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pathParam]);

  const navigateToPath = (nextPath: string) => {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("path", nextPath);
      router.push(`/library/folders?${params.toString()}`);
    });
  };

  const handleFolderClick = (folderName: string) => {
    const nextPath = pathParam === "/" ? `/${folderName}` : `${pathParam}/${folderName}`;
    navigateToPath(nextPath);
  };

  const handleBackClick = () => {
    if (pathParam === "/") return;
    const lastSlashIdx = pathParam.lastIndexOf("/");
    const parentPath = lastSlashIdx === 0 ? "/" : pathParam.slice(0, lastSlashIdx);
    navigateToPath(parentPath);
  };

  // Build breadcrumbs for navigation
  const segments = pathParam.split("/").filter(Boolean);

  return (
    <PageContainer
      title="Folders"
      description="Browse your Google Drive catalog using your original folder structures."
    >
      <div className="space-y-6">
        {/* Breadcrumb / Path Navigation header */}
        <GlassPanel className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs md:text-sm font-medium text-foreground/80 overflow-x-auto scrollbar-none py-1">
            <span
              onClick={() => navigateToPath("/")}
              className="hover:text-brand-primary cursor-pointer transition-all font-semibold"
            >
              Root
            </span>
            {segments.map((seg, idx) => {
              const fullPath = "/" + segments.slice(0, idx + 1).join("/");
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-foreground/30">/</span>
                  <span
                    onClick={() => navigateToPath(fullPath)}
                    className="hover:text-brand-primary cursor-pointer transition-all font-semibold whitespace-nowrap"
                  >
                    {seg}
                  </span>
                </div>
              );
            })}
          </div>

          {pathParam !== "/" && (
            <button
              onClick={handleBackClick}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold cursor-pointer active:scale-95 transition-all text-foreground/80 disabled:opacity-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Up One Level
            </button>
          )}
        </GlassPanel>

        {loading || isPending ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 text-brand-primary animate-spin" />
            <p className="text-sm text-foreground/50">Loading contents...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-center max-w-md mx-auto">
            <p className="text-sm text-red-500 font-semibold">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Folders List Grid */}
            {data.folders.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground/40 uppercase tracking-wider pl-1">Folders</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {data.folders.map((folderName) => (
                    <GlassPanel
                      key={folderName}
                      onClick={() => handleFolderClick(folderName)}
                      className="p-4 flex items-center gap-3 hover:bg-white/[0.08] border-white/5 hover:border-white/15 cursor-pointer group active:scale-[0.98] transition-all duration-150"
                    >
                      <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Folder className="h-4.5 w-4.5 fill-indigo-400/20" />
                      </div>
                      <span className="text-sm font-semibold truncate text-foreground/90 group-hover:text-foreground">
                        {folderName}
                      </span>
                    </GlassPanel>
                  ))}
                </div>
              </div>
            )}

            {/* Files List Grid */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-foreground/40 uppercase tracking-wider pl-1">Videos</h4>
              
              {data.files.length === 0 ? (
                data.folders.length === 0 ? (
                  <div className="text-center py-20 bg-card/10 rounded-2xl border border-border/20 max-w-md mx-auto p-6 space-y-2">
                    <Info className="h-8 w-8 text-foreground/30 mx-auto" />
                    <p className="text-sm font-semibold text-foreground/70">Folder is Empty</p>
                    <p className="text-xs text-foreground/40 leading-relaxed">
                      No video files larger than 100MB are synchronized inside this path.
                    </p>
                  </div>
                ) : null
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {data.files.map((file) => (
                    <div key={file.id} className="w-full flex-shrink-0 animate-scale-in" style={{ scrollSnapAlign: "start" }}>
                      <SeriesCard media={file} horizontal={true} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

export default function FoldersPage() {
  return (
    <Suspense fallback={
      <PageContainer title="Folders" description="Loading folder structure...">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 text-brand-primary animate-spin" />
          <p className="text-sm text-foreground/50">Loading...</p>
        </div>
      </PageContainer>
    }>
      <FoldersContent />
    </Suspense>
  );
}
