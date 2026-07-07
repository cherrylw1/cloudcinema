import { MetadataSyncService } from "../src/server/services/metadata-sync-service";

async function main() {
  console.log("-----------------------------------------");
  console.log("  CloudCinema Local Metadata Sync Runner  ");
  console.log("-----------------------------------------");
  console.log("Initializing metadata sync service...");

  const syncService = new MetadataSyncService();

  console.log("Starting TMDB metadata sync (batch size: 200)...");
  console.time("Metadata Sync Duration");
  
  try {
    const result = await syncService.syncBatch(200);
    console.timeEnd("Metadata Sync Duration");
    console.log("\n-----------------------------------------");
    console.log("  Metadata Sync Completed!               ");
    console.log("-----------------------------------------");
    console.log(`- Total Processed: ${result.processed}`);
    console.log(`- Matched & Saved: ${result.matched}`);
    console.log(`- Unmatched: ${result.unmatched}`);
    console.log(`- Anime Reclassified: ${result.reclassifiedAnime}`);
    console.log("-----------------------------------------");
  } catch (error) {
    console.timeEnd("Metadata Sync Duration");
    console.error("\n[Metadata Sync Failed] Error details:", error);
    process.exit(1);
  }
}

main().catch(console.error);
