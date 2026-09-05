/**
 * Resolves the caller's identity from SIP participant attributes.
 *
 * Returns `null` when the caller withheld their number. Deliberately NOT a
 * placeholder string: the previous "unknown" fallback became the upsert key for
 * `callers` (UNIQUE on agent_id + phone_number) and the lookup key in
 * `getUpcomingByPhone`, so every anonymous caller to a business collapsed into
 * one identity and the agent would read one caller's appointments to the next
 * (PLAN.md 1.8.1).
 *
 * Absent caller ID means no identity. Downstream code must handle null by asking
 * the caller for a number, never by inventing one.
 *
 * Note: caller ID is trivially spoofable, so even a present number is weak
 * identity. Confirming a second factor before reading appointment details aloud
 * is a separate, still-open decision.
 */
export function resolveCallerPhone(
  attributes: Record<string, string | undefined>,
  isTestSession: boolean
): string | null {
  // Browser test sessions have no caller at all.
  if (isTestSession) return null;

  const raw = attributes["sip.phoneNumber"]?.trim();
  return raw ? raw : null;
}
