"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface SearchBarProps {
  initialQuery?: string;
}

export function SearchBar({ initialQuery = "" }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-lg mb-6 sm:hidden">
      <Search
        className={`absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${
          focused ? "text-white/70" : "text-white/30"
        }`}
      />
      <input
        type="text"
        placeholder="Search movies, shows..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full rounded-full py-2.5 pr-4 pl-10 text-sm text-white/90 placeholder-white/35 outline-none transition-all duration-200"
        style={{
          background: focused ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${focused ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
          boxShadow: focused ? "0 0 0 3px rgba(229,9,20,0.12)" : "none",
        }}
      />
    </form>
  );
}
