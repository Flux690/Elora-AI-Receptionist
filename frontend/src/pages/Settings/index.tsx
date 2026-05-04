import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { keys, fetchers } from '@/lib/queries'
import { apiClient } from '@/lib/apiClient'
import type { Settings } from '@/types/api'
import BusinessProfileForm from './BusinessProfileForm'

export default function SettingsPage() {
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
      apiClient.patch('/admin/settings', patch),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(form)
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Business Name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          value={form.timezone}
          onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          placeholder="America/New_York"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="system-prompt">System Prompt</Label>
        <Textarea
          id="system-prompt"
          rows={6}
          value={form.systemPrompt}
          onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
        />
      </div>
      <BusinessProfileForm
        value={form.businessProfile}
        onChange={(v) => setForm((f) => ({ ...f, businessProfile: v }))}
      />
      <div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
