import type { ServiceItem, AgentProfile } from '@receptionist/shared'

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
    services: ServiceItem[]
    phoneNumber: string | null
    googleCalendarId: string | null
  }
  agent: AgentProfile
}
