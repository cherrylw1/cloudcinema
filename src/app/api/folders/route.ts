import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let pathParam = searchParams.get("path") || "/";

    // Clean path Param
    pathParam = pathParam.trim();
    if (!pathParam.startsWith("/")) {
      pathParam = "/" + pathParam;
    }
    if (pathParam.length > 1 && pathParam.endsWith("/")) {
      pathParam = pathParam.slice(0, -1);
    }

    const supabase = await createClient();

    // 1. Fetch all media files located directly in this path
    const { data: files, error: filesError } = await supabase
      .from("media_library")
      .select("*")
      .eq("folder_path", pathParam);

    if (filesError) throw filesError;

    // 2. Fetch all distinct folder paths to find direct subfolders
    const { data: allPaths, error: pathsError } = await supabase
      .from("media_library")
      .select("folder_path");

    if (pathsError) throw pathsError;

    const subfolders = new Set<string>();
    const currentSegments = pathParam === "/" ? [] : pathParam.split("/").filter(Boolean);

    for (const row of allPaths || []) {
      const fPath = row.folder_path;
      if (!fPath || fPath === pathParam) continue;

      if (fPath.startsWith(pathParam)) {
        const segments = fPath.split("/").filter(Boolean);
        
        // It must have exactly one more segment than the current path to be a direct subfolder
        if (segments.length === currentSegments.length + 1) {
          const folderName = segments[segments.length - 1];
          subfolders.add(folderName);
        } else if (segments.length > currentSegments.length + 1) {
          // If it is deeply nested, e.g. pathParam = "/" and fPath = "/Movies/Action",
          // the direct subfolder under "/" is "Movies".
          const folderName = segments[currentSegments.length];
          subfolders.add(folderName);
        }
      }
    }

    // 3. TV show grouping logic for files in the current folder:
    // If multiple episodes in the current folder share the same series name,
    // we group them into a single series object!
    const groupedItems: any[] = [];
    const tvSeriesGroups = new Map<string, any[]>();

    for (const file of files || []) {
      const isEpisodic = file.media_type === "tv-show" || file.media_type === "anime";
      if (isEpisodic && file.series) {
        if (!tvSeriesGroups.has(file.series)) {
          tvSeriesGroups.set(file.series, []);
        }
        tvSeriesGroups.get(file.series)!.push(file);
      } else {
        // Movies or standalone videos
        groupedItems.push({
          id: file.id,
          driveFileId: file.drive_file_id,
          title: file.title,
          series: file.series,
          season: file.season,
          episode: file.episode,
          mediaType: file.media_type,
          posterUrl: file.poster_url,
          backdropUrl: file.backdrop_url,
          overview: file.overview,
          runtime: file.runtime,
          fileSize: file.file_size,
          tmdbId: file.tmdb_id,
          mimeType: file.mime_type,
          dvProfile: file.dv_profile,
          audioCodec: file.audio_codec,
          processingStatus: file.processing_status,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
          folderPath: file.folder_path,
        });
      }
    }

    // Process TV series groups:
    // We represent the group as a single object which navigates to /series/[seriesName]
    for (const [seriesName, episodes] of tvSeriesGroups.entries()) {
      const rep = episodes.find(e => e.poster_url || e.backdrop_url) || episodes[0];
      
      // Save all episode IDs in the group so we can support select & delete on the group too!
      const episodeIds = episodes.map(e => e.id);

      groupedItems.push({
        id: rep.id, // Representing id
        title: seriesName,
        series: seriesName,
        mediaType: rep.media_type,
        posterUrl: rep.poster_url,
        backdropUrl: rep.backdrop_url,
        overview: rep.overview,
        tmdbId: rep.tmdb_id,
        isGroup: true,
        episodeCount: episodes.length,
        folderPath: rep.folder_path,
        episodeIds: episodeIds, // List of IDs inside the series card
      });
    }

    return NextResponse.json({
      success: true,
      currentPath: pathParam,
      folders: Array.from(subfolders).sort(),
      files: groupedItems.sort((a, b) => a.title.localeCompare(b.title)),
    });
  } catch (err) {
    console.error("[API /api/folders] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
