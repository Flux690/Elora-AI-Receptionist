import type { AppSettings } from '@/lib/settings-types'

export interface SetupItem {
  id: 'services' | 'hours' | 'calendar'
  title: string
  description: string
  minutes: string
  action: string
  to: string
  done: boolean
}

/**
 * The three things that stand between answering a phone and booking on it.
 *
 * Onboarding deliberately asks for none of them — a name, a number and a
 * timezone are all it takes to answer — so this is where they land. Two of the
 * three can be read from the data; hours cannot, because they are valid from the
 * moment a tenant exists (Mon–Fri 9–5), which is what `setup.hoursSeen` is for.
 */
export function setupItems(settings: AppSettings): SetupItem[] {
  return [
    {
      id: 'services',
      title: 'Add your services',
      description:
        'Your agent cannot quote a price or offer a time until it knows what you sell.',
      minutes: '2 min',
      action: 'Add services',
      to: '/settings?tab=business',
      done: settings.business.services.length > 0,
    },
    {
      id: 'hours',
      title: 'Set your opening hours',
      description:
        'They start at Monday to Friday, nine to five. Change them if that is not you.',
      minutes: '1 min',
      action: 'Check hours',
      to: '/settings?tab=hours',
      done: settings.setup.hoursSeen,
    },
    {
      id: 'calendar',
      title: 'Connect your calendar',
      description:
        'Your agent reads it before offering a time, and writes the booking into it.',
      minutes: '1 min',
      action: 'Connect',
      to: '/settings?tab=connections',
      done: Boolean(settings.business.calendarExternalId),
    },
  ]
}
