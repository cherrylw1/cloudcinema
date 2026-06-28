export const routes = {
  home: "/",
  library: "/library",
  movies: "/movies",
  tvShows: "/tv-shows",
  anime: "/anime",
  settings: "/settings",
} as const;

export type Routes = typeof routes;
