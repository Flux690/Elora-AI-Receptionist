/**
 * What kind of business this is, in six buckets.
 *
 * Only ever read back to a caller who asks what you do, so it names a *shape* of
 * business rather than a trade: there is no useful list of every trade, and the
 * product is not built for one vertical.
 *
 * `OTHER` is a sentinel for the picker, never a stored value. `agents.industry`
 * is free text and goes into the system prompt verbatim, so storing the literal
 * word "Other" told the agent the business was in the Other industry.
 */
export const INDUSTRIES = [
  'Hair and beauty',
  'Health and medical',
  'Fitness and wellness',
  'Home and trade',
  'Professional services',
  'Pet services',
] as const

export const OTHER = 'Something else'

/** True when the stored value came from the free-text box rather than the list. */
export function isCustomIndustry(value: string): boolean {
  return value.trim().length > 0 && !INDUSTRIES.includes(value as (typeof INDUSTRIES)[number])
}
