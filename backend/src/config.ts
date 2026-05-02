import dotenv from "dotenv";
dotenv.config();

type AppConfig = {
  port: number;
  databaseUrl?: string;
  livekit: {
    apiKey?: string;
    url?: string;
    apiSecret?: string;
  };
};

const config: AppConfig = {
  port: Number(process.env.PORT) || 8080,
  databaseUrl: process.env.DATABASE_URL,
  livekit: {
    apiKey: process.env.LIVEKIT_API_KEY,
    url: process.env.LIVEKIT_URL,
    apiSecret: process.env.LIVEKIT_API_SECRET,
  },
};

export default config;
