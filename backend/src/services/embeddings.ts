import OpenAI from "openai";
import { env } from "../env.js";

const client = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
});

export async function embedText(text: string): Promise<number[] | null> {
  try {
    const response = await client.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: text,
    });
    const embedding = response.data?.[0]?.embedding;
    if (!embedding?.length) {
      console.warn("[embeddings] empty embedding returned for input:", text.slice(0, 80));
      return null;
    }
    return embedding;
  } catch (err) {
    console.error("[embeddings] API call failed:", err);
    return null;
  }
}
