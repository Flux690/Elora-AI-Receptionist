import type { ServiceDraft } from '@receptionist/shared'

/**
 * A blank service, as onboarding and Settings both add one.
 *
 * Both screens had their own copy of these defaults, so changing the starting
 * length in one would have left the other quietly disagreeing about what a new
 * service looks like.
 */
export const emptyService = (): ServiceDraft => ({
  name: '',
  price: '',
  description: '',
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  requiredResources: [],
})
