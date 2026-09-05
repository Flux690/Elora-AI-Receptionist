import type {
  Service,
  BusinessHours,
  BookingPolicy,
  AgentProfile,
  CalendarProvider,
  CalendarPayload,
  AgentSetup,
} from '@receptionist/shared'

/** The Settings response as the forms consume it, nested where the flat
 *  `BusinessSettings` is not. */
export interface AppSettings {
  business: {
    name: string
    industry: string
    timezone: string
    description: string
    services: Service[]
    businessHours: BusinessHours
    bookingPolicy: BookingPolicy
    /** The owner's preference. Recording also needs storageConfigured. */
    recordCalls: boolean
    storageConfigured: boolean
    phoneNumber: string | null
    /** Which system holds the calendar, its id there, and its display name. */
    calendarProvider: CalendarProvider | null
    calendarExternalId: string | null
    calendarPayload: CalendarPayload | null
  }
  agent: AgentProfile
  /** What the owner has been through, for the checklist on Home. */
  setup: AgentSetup
}
