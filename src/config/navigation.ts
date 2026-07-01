import { routes } from "@/config/routes";
import { type NavigationItem } from "@/types";
import { Bookmark } from "lucide-react";

export const navigationItems: NavigationItem[] = [
  { label: "Home", href: routes.home, icon: "Home" },
  { label: "Library", href: routes.library, icon: "FolderHeart" },
  { label: "Watchlist", href: "/watchlist", icon: Bookmark },
  { label: "Movies", href: routes.movies, icon: "Film" },
  { label: "TV Shows", href: routes.tvShows, icon: "Tv" },
  { label: "Anime", href: routes.anime, icon: "Sparkles" },
  { label: "Settings", href: routes.settings, icon: "Settings" },
];
