export class EmbeddingService {
  private openrouterKey: string;

  constructor() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error("[EmbeddingService] OPENROUTER_API_KEY environment variable is not defined.");
    }
    this.openrouterKey = key;
  }

  /**
   * Generates a 1536-dimensional semantic vector embedding for a given text input.
   * Uses openai/text-embedding-3-small via OpenRouter.
   */
  async getEmbedding(text: string): Promise<number[]> {
    const cleanText = text.trim().replace(/\s+/g, " ");
    if (!cleanText) {
      throw new Error("[EmbeddingService] Input text cannot be empty.");
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.openrouterKey}`,
          "HTTP-Referer": "https://cloudcinema.vercel.app",
          "X-Title": "CloudCinema",
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-small",
          input: cleanText,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter embeddings API error (${response.status}): ${errText}`);
      }

      const payload = await response.json();
      const embedding = payload?.data?.[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error("[EmbeddingService] Invalid embeddings payload returned from OpenRouter.");
      }

      return embedding;
    } catch (err) {
      console.error("[EmbeddingService] Failed to fetch embedding:", err);
      throw err;
    }
  }
}
