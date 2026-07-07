import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch the media item details
    const { data: media, error: mediaError } = await supabase
      .from("media_library")
      .select("*")
      .eq("id", id)
      .single();

    if (mediaError || !media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // If analysis is already cached, return it immediately
    if (media.taste_analysis) {
      return NextResponse.json(media.taste_analysis);
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json({ error: "OpenRouter API Key is missing on the server" }, { status: 400 });
    }

    // 2. Fetch user's watch history to compare tastes (limit 15)
    const { data: watchHistoryData } = await supabase
      .from("user_progress")
      .select(`completed, media_library:media_id (title, media_type, series)`)
      .eq("profile_id", user.id)
      .limit(15);

    const historyList = (watchHistoryData || [])
      .map((item) => {
        const m = Array.isArray(item.media_library) ? item.media_library[0] : item.media_library;
        return m ? (m.series || m.title) : null;
      })
      .filter(Boolean);

    const systemPrompt = `You are a cinematic analyst. Analyze the selected film/series based on the user's watch history.
Write:
1. "fit": An paragraph explaining why this film fits their taste (e.g. "Because you recently watched and finished Breaking Bad, you'll love how this series builds intense moral conflict..."). If their history is empty, write a general taste fit welcoming them to the film.
2. "trivia": An array of 3 to 4 interesting, high-quality production details, camera/cinematography techniques (e.g. shot in 35mm using natural light, specific director choices), or behind-the-scenes trivia that cinematic enthusiasts appreciate.

You must respond with a raw JSON object matching this schema:
{
  "fit": "Paragraph text explaining why the user will enjoy it based on watch history",
  "trivia": [
    "Trivia fact 1",
    "Trivia fact 2",
    "Trivia fact 3"
  ]
}`;

    const userPrompt = `Media Item to Analyze:
Title: ${media.series || media.title}
Overview: ${media.overview || "No overview available."}
Type: ${media.media_type}

User Watch History: ${JSON.stringify(historyList)}`;

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
        temperature: 0.7,
      }),
    });

    if (!openrouterRes.ok) {
      const errorText = await openrouterRes.text();
      console.error("[Analysis OpenRouter] Failed:", errorText);
      return NextResponse.json({ error: "API call failed" }, { status: 500 });
    }

    const completion = await openrouterRes.json();
    const responseText = completion.choices?.[0]?.message?.content;
    if (!responseText) {
      throw new Error("Empty response from OpenRouter");
    }

    const analysisData = JSON.parse(responseText);

    // Cache the result in media_library taste_analysis column
    await supabase
      .from("media_library")
      .update({ taste_analysis: analysisData })
      .eq("id", id);

    return NextResponse.json(analysisData);
  } catch (err) {
    console.error("[Analysis API] Server error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
