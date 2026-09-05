import type { ServiceDraft } from '@receptionist/shared'

/** One definition, so onboarding and Settings agree on what a new service is. */
export const emptyService = (): ServiceDraft => ({
  name: '',
  price: '',
  description: '',
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  requiredResources: [],
})
