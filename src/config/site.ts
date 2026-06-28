export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "CloudCinema",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  description: "A premium personal media streaming platform.",
  navItems: [
    { label: "Home", href: "/", icon: "Home" },
    { label: "Library", href: "/library", icon: "FolderHeart" },
    { label: "Movies", href: "/movies", icon: "Film" },
    { label: "TV Shows", href: "/tv-shows", icon: "Tv" },
    { label: "Anime", href: "/anime", icon: "Sparkles" },
    { label: "Settings", href: "/settings", icon: "Settings" },
  ] as const,
};

export type SiteConfig = typeof siteConfig;
