import { createClerkClient } from "@clerk/backend";
import { env } from "../env.js";
import { LRUCache } from "../lru.js";

/**
 * One implementation and one cache, shared by the dashboard's calendar picker
 * and the live-call booking path.
 */
const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Tokens last 60 minutes, cached for 50 to avoid an expiry race while a caller waits.
const OAUTH_TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;
const tokenCache = new LRUCache<string, { token: string; expiresAt: number }>(200);

export async function getGoogleOAuthToken(clerkUserId: string): Promise<string | null> {
  const cached = tokenCache.get(clerkUserId);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  try {
    const r = await clerkClient.users.getUserOauthAccessToken(clerkUserId, "google");
    const token = r.data[0]?.token ?? null;
    if (token) {
      tokenCache.set(clerkUserId, {
        token,
        expiresAt: Date.now() + OAUTH_TOKEN_CACHE_TTL_MS,
      });
    }
    return token;
  } catch (err) {
    console.error("[google-auth] failed to fetch OAuth token:", err);
    return null;
  }
}

/** A revoked grant would otherwise keep looking valid here for up to 50 minutes. */
export function forgetGoogleOAuthToken(clerkUserId: string): void {
  tokenCache.delete(clerkUserId);
}
