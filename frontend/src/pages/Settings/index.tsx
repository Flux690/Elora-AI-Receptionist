import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, PhoneOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { keys, fetchers } from '@/lib/queries'
import { apiClient } from '@/lib/apiClient'
import type { Settings, Vertical, AvailableNumber } from '@/types/api'
import BusinessDetailsForm from './BusinessDetailsForm'

const TIMEZONES = Intl.supportedValuesOf('timeZone')
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

const VERTICALS: { value: Vertical; label: string }[] = [
  { value: 'salon', label: 'Salon' },
  { value: 'spa', label: 'Spa' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'home_service', label: 'Home Service' },
]

function formatPhone(e164: string) {
  const d = e164.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  return e164
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const { signOut } = useClerk()
  const { data } = useQuery({ queryKey: keys.settings, queryFn: fetchers.settings })

  const [form, setForm] = useState<Settings>({
    name: '',
    vertical: 'salon',
    timezone: '',
    additionalInstructions: '',
    businessProfile: {},
    googleCalendarId: null,
    phoneNumber: null,
    sipDispatchRuleId: null,
  })

  const googleAccount = user?.externalAccounts.find(ea => ea.provider === 'google')
  const hasCalendarScope = googleAccount?.approvedScopes?.includes(CALENDAR_SCOPE)
  const isCalendarConnected = !!data?.googleCalendarId && hasCalendarScope

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const mutation = useMutation({
    mutationFn: (patch: Partial<Settings>) =>
      apiClient.patch('/admin/settings', patch).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.settings }),
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(form)
  }

  // --- Phone number state ---
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [areaCode, setAreaCode] = useState('')
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([])
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [releasing, setReleasing] = useState(false)

  async function handlePhoneSearch() {
    setSearching(true)
    setAvailableNumbers([])
    setSelectedNumber(null)
    try {
      const res = await apiClient.get<AvailableNumber[]>(`/admin/phone/search?areaCode=${areaCode}`)
      setAvailableNumbers(res.data)
    } finally {
      setSearching(false)
    }
  }

  async function handleProvision() {
    if (!selectedNumber) return
    setProvisioning(true)
    try {
      await apiClient.post('/admin/phone/provision', { phoneNumber: selectedNumber })
      await queryClient.invalidateQueries({ queryKey: keys.settings })
      setPhoneDialogOpen(false)
      setAvailableNumbers([])
      setSelectedNumber(null)
    } finally {
      setProvisioning(false)
    }
  }

  async function handleRelease() {
    setReleasing(true)
    try {
      await apiClient.delete('/admin/phone')
      await queryClient.invalidateQueries({ queryKey: keys.settings })
    } finally {
      setReleasing(false)
    }
  }

  // --- Delete account ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await apiClient.delete('/admin/account')
      await signOut()
      navigate('/sign-in')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="font-heading text-2xl font-semibold mb-8">Settings</h1>

      <form onSubmit={handleSave} className="max-w-xl space-y-10">

        {/* Business Info */}
        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Business Info</h2>
          <div className="space-y-1.5">
            <Label htmlFor="name">Business Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Bloom Day Spa"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vertical">Business Type</Label>
            <Select value={form.vertical} onValueChange={v => setForm(f => ({ ...f, vertical: v as Vertical }))}>
              <SelectTrigger id="vertical">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERTICALS.map(v => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={form.timezone} onValueChange={v => setForm(f => ({ ...f, timezone: v ?? '' }))}>
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select a timezone…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <Separator />

        {/* Additional Instructions */}
        <section className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Additional Instructions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Optional. Tell the AI how to greet callers, what tone to use, and anything it should always say or never say.
            </p>
          </div>
          <div className="space-y-1.5">
            <Textarea
              id="additional-instructions"
              rows={7}
              value={form.additionalInstructions}
              onChange={e => setForm(f => ({ ...f, additionalInstructions: e.target.value }))}
              placeholder="e.g. Always greet callers warmly using our business name. Use a friendly but professional tone. Never quote prices without checking availability first."
            />
          </div>
        </section>

        <Separator />

        {/* Business Details */}
        <section className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Business Details</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The AI uses this to answer callers' questions about your business.
            </p>
          </div>
          <BusinessDetailsForm
            value={form.businessProfile}
            onChange={v => setForm(f => ({ ...f, businessProfile: v }))}
          />
        </section>

        <Separator />

        {/* Google Calendar */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Google Calendar</h2>
          {isCalendarConnected ? (
            <p className="text-sm text-foreground">
              Connected as <span className="font-medium">{googleAccount?.emailAddress}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not connected.{' '}
              <Link to="/appointments" className="text-primary underline-offset-4 hover:underline">
                Set up in Appointments →
              </Link>
            </p>
          )}
        </section>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      {/* Phone Number — outside form */}
      <div className="max-w-xl mt-10 space-y-10">
        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Phone Number</h2>

          {data?.phoneNumber ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Phone className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">{formatPhone(data.phoneNumber)}</span>
              </div>
              <Dialog>
                <DialogTrigger render={<Button variant="ghost" size="sm" disabled={releasing} />}>
                  <PhoneOff className="size-4 mr-1.5" />
                  Release
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Release phone number?</DialogTitle>
                    <DialogDescription>
                      This will release {formatPhone(data.phoneNumber)} and callers will no longer be able to reach your AI receptionist. This cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="destructive" onClick={handleRelease} disabled={releasing}>
                      {releasing ? 'Releasing…' : 'Release number'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No phone number assigned. Get a number so callers can reach your AI receptionist.
              </p>
              <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  <Phone className="size-4 mr-1.5" />
                  Get a phone number
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Get a phone number</DialogTitle>
                    <DialogDescription>
                      Search for available US numbers by area code.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Area code, e.g. 415"
                        value={areaCode}
                        onChange={e => setAreaCode(e.target.value)}
                        maxLength={3}
                        className="w-36"
                      />
                      <Button onClick={handlePhoneSearch} disabled={searching} variant="outline">
                        {searching ? 'Searching…' : 'Search'}
                      </Button>
                    </div>

                    {availableNumbers.length > 0 && (
                      <div className="space-y-1 max-h-56 overflow-y-auto">
                        {availableNumbers.map(n => (
                          <button
                            key={n.e164_format}
                            type="button"
                            onClick={() => setSelectedNumber(n.e164_format)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm border transition-colors ${
                              selectedNumber === n.e164_format
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-muted/50'
                            }`}
                          >
                            <span className="font-medium">{formatPhone(n.e164_format)}</span>
                            <span className="text-muted-foreground">{n.locality}, {n.region}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleProvision}
                      disabled={!selectedNumber || provisioning}
                    >
                      {provisioning ? 'Purchasing…' : 'Confirm purchase'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </section>

        <Separator />

        {/* Danger Zone */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-destructive">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account, all call history, appointments, knowledge base, and release your phone number.
          </p>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger render={<Button variant="destructive" size="sm" />}>
              <Trash2 className="size-4 mr-1.5" />
              Delete account
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete account?</DialogTitle>
                <DialogDescription>
                  This will permanently delete your account, all call history, appointments, escalations, knowledge base, and release your phone number. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Yes, delete everything'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </div>
    </div>
  )
}
