import type {
  Service,
  BusinessHours,
  BookingPolicy,
  AgentProfile,
  CalendarProvider,
  CalendarPayload,
} from '@receptionist/shared'

/**
 * Frontend-shaped Settings response. The backend returns the business config
 * grouped under `business` and the agent under `agent` for easier form binding.
 *
 * The `BusinessSettings` interface in @receptionist/shared models the same
 * data flat — that flat shape is what the API contract actually serialises.
 * If the API response is reshaped, update here only.
 */
export interface AppSettings {
  business: {
    name: string
    industry: string
    timezone: string
    description: string
    services: Service[]
    businessHours: BusinessHours
    bookingPolicy: BookingPolicy
    /** Whether calls are recorded. Also selects which AI disclosure plays. */
    recordCalls: boolean
    phoneNumber: string | null
    /**
     * Which system holds the calendar, its id there, and its display name.
     * Three fields rather than one `googleCalendarId`, because the schema no
     * longer names a vendor in a column (PLAN.md 2.5).
     */
    calendarProvider: CalendarProvider | null
    calendarExternalId: string | null
    calendarPayload: CalendarPayload | null
  }
  agent: AgentProfile
}
