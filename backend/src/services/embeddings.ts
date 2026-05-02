import OpenAI from "openai";
import config from "../config.js";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!config.openai.apiKey) return null;
  if (!client) client = new OpenAI({ apiKey: config.openai.apiKey });
  return client;
}

export async function embedText(text: string): Promise<number[] | null> {
  const openai = getClient();
  if (!openai) {
    console.warn("[embeddings] OPENAI_API_KEY not set — skipping embedding");
    return null;
  }

  const response = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: text,
  });

  return response.data[0].embedding;
}
