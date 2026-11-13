import { useState } from "react";

const watchlistKey = "thresh.explore.watchlist";

export default function useExploreWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(watchlistKey) ?? "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  function toggleWatchlist(id: string) {
    const next = watchlist.includes(id) ? watchlist.filter((savedId) => savedId !== id) : [...watchlist, id];
    setWatchlist(next);
    try {
      window.localStorage.setItem(watchlistKey, JSON.stringify(next));
    } catch {
      // Keep the watchlist available for the current session.
    }
  }

  return { watchlist, toggleWatchlist };
}
