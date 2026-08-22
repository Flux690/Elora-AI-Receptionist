import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AvailableNumber } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiClient } from '@/lib/apiClient'
import { keys } from '@/lib/queries'
import { formatPhone } from '@/lib/formatters'
import type { AppSettings } from '@/lib/settings-types'
import { CalendarSection } from './CalendarSection'
import { ServicesSection } from './ServicesSection'
import { Section, Field } from './Section'

/**
 * Every zone this browser knows, straight from the platform. Not a hand-curated
 * list: the backend validates against Node's own database, and a shorter list
 * here would just be a different set of zones that fails validation there.
 */
const TIMEZONES: string[] = Intl.supportedValuesOf('timeZone')

export function BusinessTab({ settings }: { settings: AppSettings }) {
  const qc = useQueryClient()

  const [form, setForm] = useState({
    name: settings.business.name,
    industry: settings.business.industry,
    timezone: settings.business.timezone,
    description: settings.business.description,
  })
  const [areaCode, setAreaCode] = useState('')
  const [numbers, setNumbers] = useState<AvailableNumber[]>([])
  const [searching, setSearching] = useState(false)
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false)

  const save = useMutation({
    mutationFn: () => apiClient.patch('/admin/settings', { business: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      toast.success('Business settings saved')
    },
    onError: () => toast.error('Failed to save settings'),
  })

  const releasePhone = useMutation({
    mutationFn: () => apiClient.delete('/admin/phone'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      toast.success('Phone number released')
    },
    onError: () => toast.error('Failed to release number'),
  })

  const provisionPhone = useMutation({
    mutationFn: (phoneNumber: string) =>
      apiClient.post('/admin/phone/provision', { phoneNumber }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      setNumbers([])
      setAreaCode('')
      toast.success('Phone number provisioned')
    },
    onError: () => toast.error('Failed to provision number'),
  })

  async function searchNumbers() {
    if (areaCode.length !== 3 || searching) return
    setSearching(true)
    try {
      const res = await apiClient.get<AvailableNumber[]>(
        `/admin/phone/search?areaCode=${areaCode}`,
      )
      setNumbers(res.data)
      if (res.data.length === 0) toast.info('No numbers found for this area code')
    } catch {
      toast.error('Search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div>
      <Section title="Business details" lede="What your agent tells callers about you.">
        <Field
          label="Business name"
          help="Said out loud when the agent answers."
          htmlFor="biz-name"
        >
          <Input
            id="biz-name"
            className="w-[300px]"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>

        <Field label="Industry" help="Helps the agent describe what you do." htmlFor="industry">
          <Input
            id="industry"
            className="w-[300px]"
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
          />
        </Field>

        <Field
          label="Timezone"
          help="Every date and time the agent says is in this zone."
          htmlFor="timezone"
        >
          {/* A picker, not a text box. Every date the agent says is formatted in
              this zone, and an unknown one throws inside the agent's constructor
              — so a typo here used to take the agent off the air silently. */}
          <Select
            value={form.timezone}
            onValueChange={(v) => v && setForm((f) => ({ ...f, timezone: v }))}
          >
            <SelectTrigger id="timezone" className="w-[300px]">
              <SelectValue placeholder="Select a timezone" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="About" lede="Answers to the things callers ask that aren't bookings.">
        <Field
          label="Description"
          help="Parking, who you are, how long you've been open."
          htmlFor="description"
        >
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="min-h-20 resize-none"
          />
        </Field>

        <div className="flex justify-start pt-1">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Section>

      <Section layout="gutter" title="Services" lede="What you offer, and how long each one takes.">
        <ServicesSection services={settings.business.services} />
      </Section>

      <Section title="Connections" lede="Where calls arrive, and where bookings go.">
        {settings.business.phoneNumber ? (
          <div>
            <span className="text-sm font-medium text-foreground">Phone number</span>
            <p className="mt-px mb-[7px] text-sm text-muted-foreground">
              Your agent answers this number.
            </p>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="text-sm tabular-nums text-foreground">
                {formatPhone(settings.business.phoneNumber)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReleaseConfirm(true)}
                disabled={releasePhone.isPending}
                className="text-destructive hover:text-destructive"
              >
                {releasePhone.isPending ? 'Releasing…' : 'Release'}
              </Button>
            </div>
          </div>
        ) : (
          <Field
            label="Phone number"
            help="Search by area code to get a number your agent answers."
          >
            <div className="flex gap-2">
              <Input
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') searchNumbers()
                }}
                placeholder="Area code"
                maxLength={3}
                className="w-28"
              />
              <Button
                variant="outline"
                onClick={searchNumbers}
                disabled={areaCode.length !== 3 || searching}
              >
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </div>
            {numbers.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {numbers.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => provisionPhone.mutate(n.e164_format)}
                    disabled={provisionPhone.isPending}
                    className="flex w-[380px] items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-hover disabled:opacity-40"
                  >
                    <span className="font-medium text-foreground">
                      {formatPhone(n.e164_format)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {n.locality}, {n.region}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}

        <CalendarSection settings={settings} />
      </Section>

      <ConfirmDialog
        open={showReleaseConfirm}
        onOpenChange={setShowReleaseConfirm}
        title="Release phone number?"
        description="Your agent will stop receiving calls on this number. This cannot be undone."
        confirmLabel="Release"
        variant="destructive"
        onConfirm={async () => {
          await releasePhone.mutateAsync()
        }}
      />
    </div>
  )
}
