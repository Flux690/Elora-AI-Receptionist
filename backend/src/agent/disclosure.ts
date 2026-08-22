/**
 * The sentence every caller hears first, before the tenant's own greeting.
 *
 * Not a database column and not editable from the dashboard, deliberately.
 *
 * California AB 2905 and SB 243 require a caller to be told they are speaking to
 * an AI *before any substantive interaction*, at $500 per call, and eleven to
 * thirteen states require all-party consent to record — the stricter law governs
 * a call that crosses state lines. `agentProfile.greeting` is entirely
 * tenant-authored free text, so a tenant could and would write a greeting with
 * neither disclosure. The platform built the system that omits it, so the
 * platform carries the exposure; letting a tenant switch it off would be
 * handing them a way to create our liability.
 */
export const DISCLOSURE_VERSION = "2026-08-v1";

export const AI_DISCLOSURE =
  "Just so you know, you're speaking with an AI assistant, and this call is recorded.";

/**
 * The disclosure, then the tenant's greeting.
 *
 * Falls back to the disclosure alone when a tenant has left their greeting
 * blank: silence is not an acceptable answer to a ringing phone, and the
 * required sentence is still required.
 */
export function buildGreeting(tenantGreeting: string): string {
  const greeting = tenantGreeting.trim();
  return greeting ? `${AI_DISCLOSURE} ${greeting}` : AI_DISCLOSURE;
}
