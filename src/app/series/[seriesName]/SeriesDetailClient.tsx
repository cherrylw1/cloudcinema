"use client";

import { EditMetadataButton } from "@/components/media/EditMetadataButton";

interface SeriesDetailClientProps {
  seriesName: string;
  defaultType: "movie" | "tv";
}

export function SeriesDetailClient({ seriesName, defaultType }: SeriesDetailClientProps) {
  return (
    <EditMetadataButton
      seriesName={seriesName}
      defaultType={defaultType}
      className="flex items-center gap-2 px-4 py-2.5 border border-white/30 text-white rounded-lg font-medium text-sm hover:bg-white/10 transition-all cursor-pointer"
    />
  );
}
