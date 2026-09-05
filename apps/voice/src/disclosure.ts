import { disclosureFor, type Disclosure } from "@receptionist/shared";

/**
 * The disclosure, then the tenant's greeting.
 *
 * The wordings and their version ids live in `@receptionist/shared` because the
 * dashboard has to show the owner what plays; the reasoning for why they are
 * platform-owned lives there with them. What stays here is the agent's use of
 * them.
 *
 * Two wordings, not one, since a tenant can now turn recording off: claiming a
 * call is recorded when it is not is its own problem, and the AI half of the
 * sentence is never optional either way.
 */
export {
  AI_DISCLOSURE_RECORDED,
  AI_DISCLOSURE_NOT_RECORDED,
  DISCLOSURE_VERSION_RECORDED,
  DISCLOSURE_VERSION_NOT_RECORDED,
  disclosureFor,
} from "@receptionist/shared";

export type { Disclosure } from "@receptionist/shared";

/**
 * Falls back to the disclosure alone when a tenant has left their greeting
 * blank: silence is not an acceptable answer to a ringing phone, and the
 * required sentence is still required.
 *
 * Returns the version alongside the text so the caller cannot stamp the call row
 * with an id that disagrees with what was said — the whole value of the audit
 * trail is that the two match.
 */
export function buildGreeting(
  tenantGreeting: string,
  recordCalls: boolean
): Disclosure {
  const disclosure = disclosureFor(recordCalls);
  const greeting = tenantGreeting.trim();

  return {
    text: greeting ? `${disclosure.text} ${greeting}` : disclosure.text,
    version: disclosure.version,
  };
}
