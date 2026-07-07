import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { createAdminClient } from "@/clients/supabase/admin";
import type { Database } from "@/types/database";

type MediaRow_DB = Database["public"]["Tables"]["media_library"]["Row"];

export async function POST() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient(); // Bypasses RLS to write cache to profiles
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json({ error: "OpenRouter API Key is missing on the server" }, { status: 400 });
    }

    // 1. Fetch user watch history (limit 8 to get recently active items)
    const { data: watchHistory } = await supabase
      .from("user_progress")
      .select(`playback_position, completed, last_watched, media_library:media_id (*)`)
      .eq("profile_id", user.id)
      .order("last_watched", { ascending: false })
      .limit(8);

    // Filter items that have embeddings in watch history
    const historyItems = (watchHistory || [])
      .map((item) => {
        const m = Array.isArray(item.media_library) ? item.media_library[0] : item.media_library;
        return m ? (m as MediaRow_DB) : null;
      })
      .filter((m): m is MediaRow_DB => m !== null);

    const historyWithEmbeddings = historyItems.filter((item) => item.embedding !== null);

    // 2. Fetch semantic similarity candidates for recently watched items
    const candidatesMap = new Map<string, any>();

    // For each recently watched item, retrieve 8 most similar items from the database
    for (const watched of historyWithEmbeddings) {
      const { data: matches } = await supabase.rpc("match_media", {
        query_embedding: watched.embedding,
        match_threshold: 0.15,
        match_count: 8,
      });

      if (matches) {
        for (const m of matches) {
          // Don't recommend the item itself
          if (m.id === watched.id) continue;
          candidatesMap.set(m.id, {
            id: m.id,
            title: m.series || m.title,
            type: m.media_type,
            overview: m.overview || "",
            similarity: m.similarity,
          });
        }
      }
    }

    // 3. Supplement with general catalog items (trending/recently added) to fill list
    const { data: recentAdditions } = await supabase
      .from("media_library")
      .select("id, title, series, media_type, overview")
      .order("created_at", { ascending: false })
      .limit(40);

    if (recentAdditions) {
      for (const item of recentAdditions) {
        if (candidatesMap.size >= 80) break;
        if (!candidatesMap.has(item.id)) {
          candidatesMap.set(item.id, {
            id: item.id,
            title: item.series || item.title,
            type: item.media_type,
            overview: item.overview || "",
            similarity: 0.0,
          });
        }
      }
    }

    const candidatesList = Array.from(candidatesMap.values());

    if (candidatesList.length === 0) {
      return NextResponse.json({ recommendations: [], marathons: [] });
    }

    // 4. Format watch history context for the LLM
    const formattedHistory = historyItems.map((item) => ({
      title: item.series || item.title,
      type: item.media_type,
    }));

    // 5. Prompt Gemini 2.5 Flash Lite to curate custom personalized rows & marathons
    const systemPrompt = `You are a premium cinema curation assistant.
Below is the user's recently watched history and the list of candidate movies/series retrieved from their library database.

Your task is to compile:
1. "recommendations": A list of up to 10 recommended items from the provided candidates list. Include a short, customized "reason" for each based on their history (e.g. "Because you recently watched Breaking Bad, explore this tense crime drama").
2. "marathons": 3 to 4 premium, themed Netflix-style movie marathons or double-features. Each marathon must have a "title" (e.g., "Cosmic Anomalies & Realities"), a "reason" explaining the thematic connection, and "itemIds" (an array of 2 to 4 item IDs from the provided candidate list that fit this theme).

Rules:
- You MUST only select item IDs that exist in the provided candidates list. Never invent or recommend titles not in the list.
- Make category titles and reasons sound extremely cinematic, personalized, and customized.
- Respond with a raw JSON object matching the JSON Schema below:
{
  "recommendations": [
    {
      "id": "uuid-string",
      "title": "Movie or Series Title",
      "reason": "Personalized reason based on watch history"
    }
  ],
  "marathons": [
    {
      "title": "Thematic Title",
      "reason": "tagline explaining the collection",
      "itemIds": ["uuid-1", "uuid-2"]
    }
  ]
}`;

    const userPrompt = `Candidate Movies & Series list:
${JSON.stringify(candidatesList, null, 2)}

User Watch History:
${JSON.stringify(formattedHistory, null, 2)}`;

    // Call OpenRouter API using google/gemini-2.5-flash-lite
    const openrouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
        "HTTP-Referer": "https://cloudcinema.vercel.app",
        "X-Title": "CloudCinema",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.65,
      }),
    });

    if (!openrouterRes.ok) {
      const errorText = await openrouterRes.text();
      console.error("[Recommendations LLM] OpenRouter call failed:", errorText);
      return NextResponse.json({ error: "Curation API call failed" }, { status: 500 });
    }

    const completion = await openrouterRes.json();
    const responseText = completion.choices?.[0]?.message?.content;
    if (!responseText) {
      throw new Error("Empty response from OpenRouter");
    }

    const recommendationsData = JSON.parse(responseText);

    // Save recommendations and timestamp inside profiles recommendations column (bypassing RLS with admin client)
    const { error: saveError } = await adminClient
      .from("profiles")
      .update({
        recommendations: {
          updatedAt: new Date().toISOString(),
          data: recommendationsData,
        },
      })
      .eq("id", user.id);

    if (saveError) {
      console.error("[Recommendations API] Failed to cache results:", saveError);
    }

    return NextResponse.json(recommendationsData);
  } catch (err: any) {
    console.error("[Recommendations API] Server error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
