"use client";

import { useState, useMemo } from "react";
import { Search, FolderPlus, ArrowUpDown, ChevronUp, ChevronDown, Loader2, ArrowLeft, X, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Media } from "@/repositories/media";

interface GroupingClientProps {
  initialMedia: Media[];
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "0.00 GB";
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(2)} GB`;
}

export function GroupingClient({ initialMedia }: GroupingClientProps) {
  const [mediaList, setMediaList] = useState<Media[]>(initialMedia);
  const [search, setSearch] = useState("");
  const [filterUngrouped, setFilterUngrouped] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [seriesName, setSeriesName] = useState("");
  const [mediaType, setMediaType] = useState<"tv-show" | "anime">("tv-show");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter list based on search query and ungrouped filter
  const filteredMedia = useMemo(() => {
    return mediaList.filter((media) => {
      const matchesSearch = media.title.toLowerCase().includes(search.toLowerCase()) || 
        (media.series && media.series.toLowerCase().includes(search.toLowerCase()));
      
      const matchesUngrouped = !filterUngrouped || !media.series;
      
      return matchesSearch && matchesUngrouped;
    });
  }, [mediaList, search, filterUngrouped]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const visibleIds = filteredMedia.map((m) => m.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      // Deselect all visible
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // Select all visible
      setSelectedIds((prev) => {
        const unique = new Set([...prev, ...visibleIds]);
        return Array.from(unique);
      });
    }
  };

  // Reorder selected items (for sorting episode numbers)
  const moveItem = (index: number, direction: "up" | "down") => {
    const newIds = [...selectedIds];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;

    // Swap
    const temp = newIds[index];
    newIds[index] = newIds[targetIndex];
    newIds[targetIndex] = temp;
    setSelectedIds(newIds);
  };

  const handleGroup = async () => {
    if (selectedIds.length === 0 || !seriesName.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/media/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          mediaType,
          seriesName: seriesName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Grouping failed");

      setMessage({ type: "success", text: data.message });
      
      // Update local state to reflect the new series assignment
      const updatedName = seriesName.trim();
      setMediaList((prev) =>
        prev.map((item) =>
          selectedIds.includes(item.id)
            ? { ...item, series: updatedName, mediaType }
            : item
        )
      );

      // Reset selection
      setSelectedIds([]);
      setSeriesName("");
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to group files.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete these ${selectedIds.length} selected files from database and Google Drive?`
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/media/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deletion failed");

      setMessage({ type: "success", text: data.message });

      // Update local state: remove deleted items from the list
      setMediaList((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to delete files.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get selected media items in their custom sorted order
  const selectedMediaItems = useMemo(() => {
    const map = new Map(mediaList.map((m) => [m.id, m]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as Media[];
  }, [selectedIds, mediaList]);

  return (
    <div className="space-y-6">
      {/* Return button */}
      <div>
        <Link
          href="/library"
          className="inline-flex items-center gap-2 text-xs font-semibold text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main files list selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-5 border border-border/40 bg-card/10 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Select Files to Group</h3>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/45" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search files by title..."
                  className="w-full bg-white/5 border border-border/30 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder-foreground/30 outline-none focus:border-brand-primary/50 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterUngrouped(!filterUngrouped)}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    filterUngrouped
                      ? "bg-brand-primary/10 border-brand-primary/30 text-brand-primary"
                      : "border-border/30 text-foreground/75 hover:bg-white/5"
                  }`}
                >
                  Ungrouped Only
                </button>
              </div>
            </div>

            {/* Files List */}
            <div className="max-h-[60vh] overflow-y-auto border border-border/20 rounded-xl scrollbar-none">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/20 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-foreground/60 select-none">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredMedia.length > 0 && filteredMedia.every((m) => selectedIds.includes(m.id))}
                        onChange={handleSelectAll}
                        className="rounded border-border/30 text-brand-primary focus:ring-brand-primary accent-brand-primary h-3.5 w-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">File Title</th>
                    <th className="p-3 hidden sm:table-cell">Series / Folder</th>
                    <th className="p-3 text-right">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedia.map((media) => {
                    const isSelected = selectedIds.includes(media.id);
                    return (
                      <tr
                        key={media.id}
                        onClick={() => toggleSelect(media.id)}
                        className={`border-b border-border/10 text-xs hover:bg-white/5 transition-colors cursor-pointer select-none ${
                          isSelected ? "bg-brand-primary/5" : ""
                        }`}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(media.id)}
                            className="rounded border-border/30 text-brand-primary focus:ring-brand-primary accent-brand-primary h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-medium text-foreground py-3.5">
                          <p className="line-clamp-1">{media.title}</p>
                          <span className="text-[9px] text-foreground/40 mt-0.5 block uppercase tracking-wider">
                            {media.mediaType === "anime" ? "Anime" : media.mediaType === "tv-show" ? "TV Show" : "Movie"}
                          </span>
                        </td>
                        <td className="p-3 hidden sm:table-cell text-foreground/60">
                          {media.series ? (
                            <span className="px-2 py-0.5 rounded bg-white/10 text-foreground/80 border border-white/5 text-[10px]">
                              {media.series}
                            </span>
                          ) : (
                            <span className="text-foreground/30 italic text-[10px]">None (Ungrouped)</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-foreground/60 text-[10px]">
                          {formatFileSize(media.fileSize)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMedia.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-foreground/40 text-xs italic">
                        No matching files found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Group config and sorting panel */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5 border border-border/40 bg-card/10 space-y-4 sticky top-6">
            <div className="flex items-center gap-2 text-foreground">
              <FolderPlus className="h-5 w-5 text-brand-primary" />
              <h3 className="font-bold text-sm">Group Selection</h3>
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs border ${
                  message.type === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/50 mb-1.5">
                  Series Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMediaType("tv-show")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      mediaType === "tv-show"
                        ? "bg-brand-primary border-brand-primary text-white"
                        : "border-white/10 text-white/60 hover:text-white bg-white/5"
                    }`}
                  >
                    TV Show
                  </button>
                  <button
                    onClick={() => setMediaType("anime")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      mediaType === "anime"
                        ? "bg-brand-primary border-brand-primary text-white"
                        : "border-white/10 text-white/60 hover:text-white bg-white/5"
                    }`}
                  >
                    Anime
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/50 mb-1.5">
                  Series / Folder Title
                </label>
                <input
                  type="text"
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  placeholder="e.g. Brooklyn Nine-Nine"
                  className="w-full bg-white/5 border border-border/30 rounded-xl px-4 py-2.5 text-xs text-foreground placeholder-foreground/30 outline-none focus:border-brand-primary/50 transition-colors"
                />
              </div>

              <div>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/50 mb-1.5 flex justify-between">
                  <span>Episode Sort Order ({selectedIds.length})</span>
                  {selectedIds.length > 1 && (
                    <span className="text-[9px] font-normal lowercase flex items-center gap-1">
                      <ArrowUpDown className="h-2.5 w-2.5" /> drag/sort order maps to S1E1, S1E2...
                    </span>
                  )}
                </span>

                {selectedMediaItems.length > 0 ? (
                  <div className="border border-border/20 rounded-xl max-h-56 overflow-y-auto bg-white/5 divide-y divide-border/10 scrollbar-none">
                    {selectedMediaItems.map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 text-xs text-foreground/80">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="font-medium line-clamp-1">{item.title}</p>
                          <span className="text-[9px] text-foreground/40 font-mono">Episode {index + 1}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => moveItem(index, "up")}
                            disabled={index === 0}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-foreground/60 hover:text-foreground disabled:opacity-30 disabled:hover:bg-white/5 cursor-pointer"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveItem(index, "down")}
                            disabled={index === selectedIds.length - 1}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-foreground/60 hover:text-foreground disabled:opacity-30 disabled:hover:bg-white/5 cursor-pointer"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => toggleSelect(item.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-foreground/45 hover:text-red-400 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-border/30 rounded-xl p-6 text-center text-foreground/40 text-xs italic">
                    Select files on the left to start grouping them.
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleGroup}
                  disabled={loading || selectedIds.length === 0 || !seriesName.trim()}
                  className="flex-grow py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold hover:bg-brand-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                  {loading ? "Grouping..." : "Group Series"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading || selectedIds.length === 0}
                  className="px-4 py-2.5 bg-red-600/90 hover:bg-red-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                  title="Delete selected files permanently"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
