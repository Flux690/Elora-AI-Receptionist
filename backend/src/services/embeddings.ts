import OpenAI from "openai";
import { env } from "../env.js";

const client = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
});

export async function embedText(text: string): Promise<number[] | null> {
  const response = await client.embeddings.create({
    model: env.EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}
