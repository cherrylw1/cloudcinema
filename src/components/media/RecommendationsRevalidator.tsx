"use client";

import { useEffect } from "react";

interface RecommendationsRevalidatorProps {
  cacheUpdatedAt: string | null;
}

export function RecommendationsRevalidator({ cacheUpdatedAt }: RecommendationsRevalidatorProps) {
  useEffect(() => {
    const shouldRevalidate = () => {
      if (!cacheUpdatedAt) return true;
      const lastUpdate = new Date(cacheUpdatedAt).getTime();
      const sixHoursMs = 6 * 60 * 60 * 1000;
      return Date.now() - lastUpdate > sixHoursMs;
    };

    if (shouldRevalidate()) {
      console.log("[Revalidator] Cache is stale, triggering background revalidation...");
      fetch("/api/recommendations", { method: "POST" })
        .then((res) => {
          if (res.ok) {
            console.log("[Revalidator] Recommendations cache updated successfully.");
          }
        })
        .catch((err) => {
          console.error("[Revalidator] Failed to trigger background revalidation:", err);
        });
    }
  }, [cacheUpdatedAt]);

  return null;
}
