import { PageContainer } from "@/components/layout/PageContainer";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/clients/supabase/server";
import { Film, Tv, Library, Sparkles, FolderPlus } from "lucide-react";
import Link from "next/link";

export default async function LibraryPage() {
  const supabase = await createClient();

  // Fetch counts in parallel using lightweight head queries
  const [movieRes, tvShowRes, animeRes] = await Promise.all([
    supabase
      .from("media_library")
      .select("*", { count: "exact", head: true })
      .eq("media_type", "movie"),
    supabase
      .from("media_library")
      .select("*", { count: "exact", head: true })
      .eq("media_type", "tv-show"),
    supabase
      .from("media_library")
      .select("*", { count: "exact", head: true })
      .eq("media_type", "anime"),
  ]);

  const movieCount = movieRes.count ?? 0;
  const tvShowCount = tvShowRes.count ?? 0;
  const animeCount = animeRes.count ?? 0;
  const totalCount = movieCount + tvShowCount + animeCount;

  return (
    <PageContainer
      title="Library"
      description="View and browse your consolidated catalog collections."
    >
      <div className="space-y-6">
        {/* Total Summary Card */}
        <GlassCard className="p-6 bg-card/5 border border-border/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              <Library className="h-5.5 w-5.5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Library Overview</h4>
              <p className="text-xs text-foreground/50">
                Consolidated catalog indexing status and database statistics.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/library/group"
              className="flex items-center gap-1.5 px-3 py-2 border border-brand-primary/30 bg-brand-primary/10 text-brand-primary rounded-xl text-xs font-semibold hover:bg-brand-primary hover:text-white transition-all duration-200 cursor-pointer"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Group Files
            </Link>
            <div className="text-right border-l border-border/30 pl-4">
              <span className="text-2xl font-black text-brand-primary">{totalCount}</span>
              <span className="block text-[9px] uppercase tracking-widest text-foreground/40 font-bold mt-0.5">Total Files</span>
            </div>
          </div>
        </GlassCard>

        {/* Section Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Movies Card */}
          <Link href="/movies" className="block group">
            <GlassCard className="p-6 space-y-4 bg-card/10 hover:bg-card/25 border border-border/40 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 group-hover:scale-105 transition-transform duration-300">
                  <Film className="h-6 w-6" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  Browse
                </span>
              </div>
              <div>
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {movieCount}
                </span>
                <h4 className="text-sm font-semibold text-foreground/80 mt-1">Movies</h4>
                <p className="text-xs text-foreground/45 mt-0.5">
                  Motion pictures, features, and cinematic films.
                </p>
              </div>
            </GlassCard>
          </Link>

          {/* TV Shows Card */}
          <Link href="/tv-shows" className="block group">
            <GlassCard className="p-6 space-y-4 bg-card/10 hover:bg-card/25 border border-border/40 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-500 border border-green-500/20 group-hover:scale-105 transition-transform duration-300">
                  <Tv className="h-6 w-6" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400">
                  Browse
                </span>
              </div>
              <div>
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {tvShowCount}
                </span>
                <h4 className="text-sm font-semibold text-foreground/80 mt-1">TV Shows</h4>
                <p className="text-xs text-foreground/45 mt-0.5">
                  Browse parsed series, seasons, and episodes.
                </p>
              </div>
            </GlassCard>
          </Link>

          {/* Anime Card */}
          <Link href="/anime" className="block group">
            <GlassCard className="p-6 space-y-4 bg-card/10 hover:bg-card/25 border border-border/40 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 group-hover:scale-105 transition-transform duration-300">
                  <Sparkles className="h-6 w-6" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  Browse
                </span>
              </div>
              <div>
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {animeCount}
                </span>
                <h4 className="text-sm font-semibold text-foreground/80 mt-1">Anime</h4>
                <p className="text-xs text-foreground/45 mt-0.5">
                  Browse animated shows and series collections.
                </p>
              </div>
            </GlassCard>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
