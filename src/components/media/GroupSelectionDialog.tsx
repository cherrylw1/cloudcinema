"use client";

import { useState, useEffect } from "react";
import { X, Check, Film, Tv, Loader2, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { createClient } from "@/clients/supabase/browser";

interface GroupSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSuccess?: () => void;
}

interface SelectedItem {
  id: string;
  title: string;
}

export function GroupSelectionDialog({
  isOpen,
  onClose,
  selectedIds,
  onSuccess,
}: GroupSelectionDialogProps) {
  const [targetType, setTargetType] = useState<"movie" | "tv-show" | "anime">("tv-show");
  const [seriesName, setSeriesName] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch titles for selected IDs when dialog opens
  useEffect(() => {
    if (!isOpen || selectedIds.length === 0) return;

    const fetchTitles = async () => {
      setLoadingItems(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: queryError } = await supabase
          .from("media_library")
          .select("id, title")
          .in("id", selectedIds);

        if (queryError) throw queryError;

        // Maintain the order of selectedIds
        const orderMap = new Map((data || []).map((item) => [item.id, item.title]));
        const sortedItems = selectedIds
          .map((id) => ({ id, title: orderMap.get(id) || "Untitled File" }));

        setItems(sortedItems);
      } catch (err) {
        console.error("Failed to load selected items:", err);
        setError("Failed to fetch file titles.");
      } finally {
        setLoadingItems(false);
      }
    };

    fetchTitles();
  }, [isOpen, selectedIds]);

  if (!isOpen) return null;

  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setItems(newItems);
  };

  const handleGroup = async () => {
    const isSeries = targetType === "tv-show" || targetType === "anime";
    if (isSeries && !seriesName.trim()) {
      setError("Please enter a series title.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/media/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: items.map((i) => i.id),
          mediaType: targetType,
          seriesName: isSeries ? seriesName.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to group files.");

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
        onClose();
        // Force router refresh
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl bg-[#141414] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white">Group {selectedIds.length} Selected File{selectedIds.length !== 1 ? "s" : ""}</h2>
            <p className="text-xs text-white/50 mt-0.5">Move files to a movie collection or TV show season.</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Target Type Selector */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-white/50 mb-1.5">
              Target Media Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setTargetType("tv-show")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  targetType === "tv-show"
                    ? "bg-brand-primary border-brand-primary text-white"
                    : "border-white/15 text-white/60 hover:text-white hover:border-white/30 bg-white/5"
                }`}
              >
                <Tv className="h-4 w-4" />
                TV Show
              </button>
              <button
                onClick={() => setTargetType("anime")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  targetType === "anime"
                    ? "bg-brand-primary border-brand-primary text-white"
                    : "border-white/15 text-white/60 hover:text-white hover:border-white/30 bg-white/5"
                }`}
              >
                <Tv className="h-4 w-4" />
                Anime
              </button>
              <button
                onClick={() => setTargetType("movie")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  targetType === "movie"
                    ? "bg-brand-primary border-brand-primary text-white"
                    : "border-white/15 text-white/60 hover:text-white hover:border-white/30 bg-white/5"
                }`}
              >
                <Film className="h-4 w-4" />
                Movie
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{error}</p>
          )}

          {success && (
            <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Check className="h-4 w-4" /> Files updated successfully!
            </p>
          )}

          {/* Conditional inputs */}
          {(targetType === "tv-show" || targetType === "anime") && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-white/50 mb-1.5">
                  Series / Folder Title
                </label>
                <input
                  type="text"
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  placeholder="e.g. Breaking Bad"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-brand-primary/50 transition-colors"
                />
              </div>

              {/* Sorting lists */}
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-white/50 mb-1.5 flex justify-between">
                  <span>Episode Sort Order</span>
                  <span className="text-[9px] font-normal lowercase flex items-center gap-1">
                    <ArrowUpDown className="h-2.5 w-2.5" /> maps to S1E1, S1E2...
                  </span>
                </span>

                {loadingItems ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
                  </div>
                ) : items.length > 0 ? (
                  <div className="border border-white/10 rounded-xl max-h-48 overflow-y-auto bg-white/5 divide-y divide-white/5 scrollbar-none">
                    {items.map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 text-xs text-white/80">
                        <span className="truncate pr-3 flex-1">{item.title}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => moveItem(index, "up")}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveItem(index, "down")}
                            disabled={index === items.length - 1}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {targetType === "movie" && (
            <div className="p-4 rounded-xl border border-white/5 bg-white/5">
              <p className="text-xs text-white/70 leading-relaxed">
                Confirming change will convert all selected items into independent **Movies**. 
                Their TV series names, seasons, and episode numbers will be cleared.
              </p>
            </div>
          )}

          <button
            onClick={handleGroup}
            disabled={submitting || loadingItems || selectedIds.length === 0}
            className="w-full py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold hover:bg-brand-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {submitting ? "Applying Changes..." : "Apply Grouping"}
          </button>
        </div>
      </div>
    </div>
  );
}
