import { createClerkClient } from "@clerk/backend";
import { env } from "../env.js";
import { LRUCache } from "../lru.js";

/**
 * Google OAuth access tokens, by Clerk user.
 *
 * Extracted from `agent/worker.ts` so the dashboard's calendar picker and the
 * agent's live-call booking path share one implementation and one cache. Two
 * copies of "fetch a Google token" would drift the moment one of them learned
 * something the other did not.
 *
 * This whole module is on borrowed time: PLAN.md 2.1 replaces Clerk with Better
 * Auth precisely because a network call to an auth vendor sits inside a live
 * phone call here. Keeping it behind one function is what makes that swap a
 * single-file change.
 */
const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Google access tokens are valid for 60 minutes; cache for 50 to avoid expiry
// races. Clerk refreshes under the hood on each call, so caching is purely
// about skipping that network round trip while a caller waits.
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

/**
 * Drops a cached token.
 *
 * Called when the user disconnects their calendar: the grant may be revoked at
 * Google, and a cached token would keep looking valid here for up to 50 minutes.
 */
export function forgetGoogleOAuthToken(clerkUserId: string): void {
  tokenCache.delete(clerkUserId);
}
