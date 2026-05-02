import dotenv from "dotenv";
dotenv.config();

type AppConfig = {
  port: number;
  databaseUrl?: string;
  livekit: {
    url?: string;
    apiKey?: string;
    apiSecret?: string;
  };
  openai: {
    apiKey?: string;
    embeddingModel: string;
  };
};

const config: AppConfig = {
  port: Number(process.env.PORT) || 8080,
  databaseUrl: process.env.DATABASE_URL,
  livekit: {
    url:       process.env.LIVEKIT_URL,
    apiKey:    process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
  },
  openai: {
    apiKey:         process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  },
};

export default config;
