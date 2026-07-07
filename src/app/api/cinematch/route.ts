import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { EmbeddingService } from "@/server/services/embedding-service";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json({ error: "OpenRouter API Key is missing on the server" }, { status: 400 });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Invalid search query" }, { status: 400 });
    }

    console.log(`[CineMatch] Semantic conversational query: "${query}"`);

    // 1. Generate query embedding vector
    const embedder = new EmbeddingService();
    const queryVector = await embedder.getEmbedding(query);

    // 2. Perform Cosine Similarity vector search via match_media RPC
    // A lower threshold allows creative themed filtering
    const { data: matches, error: rpcError } = await supabase.rpc("match_media", {
      query_embedding: queryVector,
      match_threshold: 0.15,
      match_count: 24,
    });

    if (rpcError) {
      console.error("[CineMatch Vector Search] Supabase RPC failed:", rpcError);
      return NextResponse.json({ error: `Similarity search error: ${rpcError.message}` }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      console.log("[CineMatch Vector Search] No semantic matches found above threshold.");
      return NextResponse.json({ results: [] });
    }

    console.log(`[CineMatch Vector Search] Found ${matches.length} semantic candidates.`);

    // 3. Format retrieved matches for the LLM context
    const candidatesList = matches.map((m: any) => ({
      id: m.id,
      title: m.series || m.title,
      type: m.media_type,
      overview: m.overview || "No plot synopsis.",
      similarity: m.similarity,
    }));

    const systemPrompt = `You are "CineMatch", a premium conversational cinema assistant.
Below are the top semantic matching movies/series retrieved from the user's library database based on their search query.

Your task is to analyze these candidates, select the ones that genuinely fit the user's prompt (up to 8 items), and format the results.
You must output a raw JSON array matching this exact Schema:
[
  {
    "id": "uuid-string",
    "title": "Movie or Series Title",
    "reason": "A 1-sentence friendly, highly personalized note explaining how this matches their prompt (e.g. 'This cozy, heartwarming film features gentle animated landscapes and a quiet spiritual journey.')"
  }
]

Rules:
- You MUST only select item IDs from the candidates list. Never suggest items not present in the candidates list.
- If a candidate doesn't match the user's query intent, discard it.
- Write natural, context-rich reasons. Do not write generic sentences.`;

    const userPrompt = `User Search Query: "${query}"

Retrieved Candidate Movies & Series from Library:
${JSON.stringify(candidatesList, null, 2)}`;

    // 4. Call google/gemini-2.5-flash-lite to filter and write customized match reasons
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
        temperature: 0.4,
      }),
    });

    if (!openrouterRes.ok) {
      const errorText = await openrouterRes.text();
      console.error("[CineMatch LLM] OpenRouter call failed:", errorText);
      return NextResponse.json({ error: "Curation API call failed" }, { status: 500 });
    }

    const completion = await openrouterRes.json();
    const responseText = completion.choices?.[0]?.message?.content;
    if (!responseText) {
      throw new Error("Empty response from OpenRouter");
    }

    const results = JSON.parse(responseText);
    const finalRecommendations = Array.isArray(results) ? results : (results.results || []);

    // 5. Map the selected candidate details back to the results list
    const matchesMap = new Map(matches.map((m: any) => [m.id, m]));
    const finalResults = finalRecommendations
      .map((rec: any) => {
        const dbMatch = matchesMap.get(rec.id) as any;
        if (!dbMatch) return null;
        return {
          id: rec.id,
          title: rec.title || dbMatch.title,
          reason: rec.reason,
          media: {
            id: dbMatch.id,
            driveFileId: dbMatch.drive_file_id || "",
            title: dbMatch.title,
            series: dbMatch.series,
            season: dbMatch.season,
            episode: dbMatch.episode,
            mediaType: dbMatch.media_type,
            posterUrl: dbMatch.poster_url,
            backdropUrl: dbMatch.backdrop_url,
            overview: dbMatch.overview,
          }
        };
      })
      .filter(Boolean);

    return NextResponse.json({ results: finalResults });
  } catch (err: any) {
    console.error("[CineMatch API] Server error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
