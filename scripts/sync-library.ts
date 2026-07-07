import { DriveSyncService } from "../src/server/services/drive-sync-service";

async function main() {
  console.log("-----------------------------------------");
  console.log("  CloudCinema Local Library Sync Runner  ");
  console.log("-----------------------------------------");
  console.log("Initializing sync service...");

  const syncService = new DriveSyncService();

  console.log("Starting Google Drive catalog sync...");
  console.time("Sync Duration");
  
  try {
    const result = await syncService.sync({ full: true });
    console.timeEnd("Sync Duration");
    console.log("\n-----------------------------------------");
    console.log("  Sync Completed Successfully!           ");
    console.log("-----------------------------------------");
    console.log(`- Total Scanned: ${result.scanned}`);
    console.log(`- Folders Traversed: ${result.folders}`);
    console.log(`- Video Files Found: ${result.videos}`);
    console.log(`- Added to Catalog: ${result.added}`);
    console.log(`- Updated in Catalog: ${result.updated}`);
    console.log(`- Skipped: ${result.skipped}`);
    console.log("-----------------------------------------");
  } catch (error) {
    console.timeEnd("Sync Duration");
    console.error("\n[Sync Failed] Error details:", error);
    process.exit(1);
  }
}

main().catch(console.error);
