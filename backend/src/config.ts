import dotenv from "dotenv";
dotenv.config();

type AppConfig = {
  port: number;
  firebase: {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
  };
  livekit: {
    apiKey?: string;
    url?: string;
    apiSecret?: string;
  };
};

const config: AppConfig = {
  port: Number(process.env.PORT) || 8080,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },
  livekit: {
    apiKey: process.env.LIVEKIT_API_KEY,
    url: process.env.LIVEKIT_URL,
    apiSecret: process.env.LIVEKIT_API_SECRET,
  },
};

export default config;
