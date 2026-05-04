import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { keys, fetchers } from '@/lib/queries'
import { apiClient } from '@/lib/apiClient'
import type { Settings } from '@/types/api'
import BusinessDetailsForm from './BusinessDetailsForm'

const TIMEZONES = Intl.supportedValuesOf('timeZone')

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: keys.settings, queryFn: fetchers.settings })

  const [form, setForm] = useState<Settings>({
    name: '',
    timezone: '',
    systemPrompt: '',
    businessProfile: {},
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const mutation = useMutation({
    mutationFn: (patch: Partial<Settings>) =>
      apiClient.patch('/admin/settings', patch).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.settings })
    },
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(form)
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
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={form.timezone} onValueChange={v => setForm(f => ({ ...f, timezone: v }))}>
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

        {/* How the AI Speaks */}
        <section className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">How the AI Speaks</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tell the AI how to greet callers, what tone to use, and anything it should always say or never say.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="system-prompt">Instructions</Label>
            <Textarea
              id="system-prompt"
              rows={7}
              value={form.systemPrompt}
              onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
              placeholder="e.g. Always greet callers warmly using our business name. Use a friendly but professional tone. Never quote prices without first checking availability."
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

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  )
}
