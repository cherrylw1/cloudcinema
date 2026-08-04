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

    if (!shouldRevalidate()) return;

    const cacheKey = `cloudcinema:recommendations-revalidated:${cacheUpdatedAt || "missing"}`;
    try {
      if (window.sessionStorage.getItem(cacheKey)) return;
      window.sessionStorage.setItem(cacheKey, "1");
    } catch {
      // Storage can be unavailable in private browsing; continue without dedupe.
    }

    // Recommendation generation is maintenance work. Defer it until the page
    // is idle so it never competes with the first scroll or navigation.
    const trigger = () => {
      fetch("/api/recommendations", { method: "POST", keepalive: true }).catch(() => {
        // A later session can retry if background generation is unavailable.
      });
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | undefined;
    const timeoutHandle = window.setTimeout(() => {
      if (idleHandle !== undefined && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }
      trigger();
    }, 1600);

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(() => {
        window.clearTimeout(timeoutHandle);
        trigger();
      }, { timeout: 2500 });
    }

    return () => {
      window.clearTimeout(timeoutHandle);
      if (idleHandle !== undefined && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, [cacheUpdatedAt]);

  return null;
}
