import { createAdminClient } from "../src/clients/supabase/admin";

async function main() {
  const supabase = createAdminClient();

  // Count how many files have been probed (audio_codec is not null or dv_profile is not null)
  const { count: probedCount, error: err1 } = await supabase
    .from("media_library")
    .select("*", { count: "exact", head: true })
    .not("audio_codec", "is", null);

  if (err1) {
    console.error("Error fetching probed count:", err1);
    return;
  }

  // Count non-null dv_profile
  const { count: dvCount, error: err2 } = await supabase
    .from("media_library")
    .select("*", { count: "exact", head: true })
    .not("dv_profile", "is", null);

  if (err2) {
    console.error("Error fetching dv count:", err2);
    return;
  }

  // Fetch some samples of probed files
  const { data: samples, error: err3 } = await supabase
    .from("media_library")
    .select("title, audio_codec, dv_profile")
    .not("audio_codec", "is", null)
    .limit(10);

  if (err3) {
    console.error("Error fetching samples:", err3);
    return;
  }

  console.log(`Probed files count (audio_codec is not null): ${probedCount}`);
  console.log(`Dolby Vision records count (dv_profile is not null): ${dvCount}`);
  console.log("Samples:", JSON.stringify(samples, null, 2));
}

main().catch(console.error);
