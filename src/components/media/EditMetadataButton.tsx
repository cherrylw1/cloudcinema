"use client";

import { useState } from "react";
import { Edit2 } from "lucide-react";
import { MetadataMatchDialog } from "@/components/media/MetadataMatchDialog";

interface EditMetadataButtonProps {
  mediaId?: string;
  seriesName?: string;
  defaultType: "movie" | "tv";
  className?: string;
}

export function EditMetadataButton({
  mediaId,
  seriesName,
  defaultType,
  className,
}: EditMetadataButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className={
          className ||
          "flex items-center gap-2 px-4 py-2 border border-white/30 text-white rounded-lg font-medium text-xs hover:bg-white/10 transition-all cursor-pointer"
        }
      >
        <Edit2 className="h-3.5 w-3.5" />
        Edit Metadata
      </button>

      <MetadataMatchDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mediaId={mediaId}
        seriesName={seriesName}
        defaultType={defaultType}
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </>
  );
}
