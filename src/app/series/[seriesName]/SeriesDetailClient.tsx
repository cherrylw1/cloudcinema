"use client";

import { useState } from "react";
import { Edit2 } from "lucide-react";
import { MetadataMatchDialog } from "@/components/media/MetadataMatchDialog";

interface SeriesDetailClientProps {
  seriesName: string;
  defaultType: "movie" | "tv";
}

export function SeriesDetailClient({ seriesName, defaultType }: SeriesDetailClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 border border-white/30 text-white rounded-lg font-medium text-sm hover:bg-white/10 transition-all cursor-pointer"
      >
        <Edit2 className="h-4 w-4" />
        Edit Metadata
      </button>

      <MetadataMatchDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        seriesName={seriesName}
        defaultType={defaultType}
        onSuccess={() => {
          // Trigger a page refresh to pick up new metadata
          window.location.reload();
        }}
      />
    </>
  );
}
