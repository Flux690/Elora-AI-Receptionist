import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/react'
import { Plus, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import type { ServiceItem, AvailableNumber } from '@receptionist/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiClient } from '@/lib/apiClient'
import { keys } from '@/lib/queries'
import { formatPhone } from '@/lib/formatters'
import type { AppSettings } from '@/lib/settings-types'
import { ServiceRow } from './ServiceRow'

export function BusinessTab({ settings }: { settings: AppSettings }) {
  const qc = useQueryClient()
  const { user } = useUser()

  const [form, setForm] = useState({
    name: settings.business.name,
    industry: settings.business.industry,
    timezone: settings.business.timezone,
    description: settings.business.description,
    services: settings.business.services as ServiceItem[],
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

  async function connectGoogleCalendar() {
    const googleAccount = user?.externalAccounts.find((a) => a.provider === 'google')
    if (googleAccount) {
      await googleAccount.reauthorize({
        additionalScopes: ['https://www.googleapis.com/auth/calendar'],
        redirectUrl: `${window.location.origin}/sso-callback?returnTo=/settings`,
      })
    } else {
      await user?.createExternalAccount({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback?returnTo=/settings`,
        additionalScopes: ['https://www.googleapis.com/auth/calendar'],
      })
    }
  }

  function addService() {
    setForm((f) => ({
      ...f,
      services: [...f.services, { name: '', price: '', description: '' }],
    }))
  }

  function updateService(i: number, patch: Partial<ServiceItem>) {
    setForm((f) => ({
      ...f,
      services: f.services.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }))
  }

  function removeService(i: number) {
    setForm((f) => ({ ...f, services: f.services.filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="biz-name">Business Name</Label>
          <Input
            id="biz-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          value={form.timezone}
          onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          placeholder="e.g. America/New_York"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="min-h-24 resize-none"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Services</Label>
          <Button variant="ghost" size="sm" onClick={addService}>
            <Plus className="size-3.5" />
            Add service
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {form.services.map((s, i) => (
            <ServiceRow
              key={i}
              service={s}
              onChange={(patch) => updateService(i, patch)}
              onRemove={() => removeService(i)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Phone Number
        </h3>
        {settings.business.phoneNumber ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="text-sm font-medium text-foreground">
                {formatPhone(settings.business.phoneNumber)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReleaseConfirm(true)}
              disabled={releasePhone.isPending}
              className="text-destructive hover:text-destructive"
            >
              {releasePhone.isPending ? 'Releasing…' : 'Release number'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              No phone number provisioned. Search by area code to get one.
            </p>
            <div className="flex gap-2">
              <Input
                value={areaCode}
                onChange={(e) =>
                  setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') searchNumbers()
                }}
                placeholder="Area code (415)"
                maxLength={3}
                className="w-36"
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
              <div className="flex flex-col gap-1.5">
                {numbers.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => provisionPhone.mutate(n.e164_format)}
                    disabled={provisionPhone.isPending}
                    className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-left text-sm hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    <span className="font-medium text-foreground">
                      {formatPhone(n.e164_format)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {n.locality}, {n.region}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Google Calendar
        </h3>
        {settings.business.googleCalendarId ? (
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Connected</p>
              <p className="text-xs text-muted-foreground">
                {settings.business.googleCalendarId}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Connect Google Calendar to let your agent check availability and book appointments.
            </p>
            <Button variant="outline" onClick={connectGoogleCalendar} className="self-start">
              <Calendar className="size-3.5" />
              Connect Google Calendar
            </Button>
          </div>
        )}
      </section>

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
