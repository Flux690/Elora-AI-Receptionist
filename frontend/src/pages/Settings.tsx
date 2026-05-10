import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser, useClerk } from '@clerk/react'
import { keys, fetchers } from '@/lib/queries'
import { apiClient } from '@/lib/apiClient'
import type { Settings, ServiceItem, AgentProfile, AvailableNumber } from '@/types/api'

const inputCls = 'w-full rounded-button border border-border bg-bg-surface px-3 py-2 text-sm text-text-1 placeholder:text-text-3 outline-none focus:border-accent transition-colors duration-150'
const labelCls = 'block text-xs font-medium text-text-2 mb-1'

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  return phone
}

// ── Business tab ──────────────────────────────────────────────────

function BusinessTab({ settings }: { settings: Settings }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: settings.business.name,
    industry: settings.business.industry,
    timezone: settings.business.timezone,
    description: settings.business.description,
    services: settings.business.services as ServiceItem[],
  })

  const save = useMutation({
    mutationFn: () => apiClient.patch('/admin/settings', { business: form }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  })

  function addService() {
    setForm(f => ({ ...f, services: [...f.services, { name: '', price: '', description: '' }] }))
  }
  function removeService(i: number) {
    setForm(f => ({ ...f, services: f.services.filter((_, idx) => idx !== i) }))
  }
  function updateService(i: number, field: keyof ServiceItem, val: string) {
    setForm(f => ({
      ...f,
      services: f.services.map((s, idx) => idx === i ? { ...s, [field]: val } : s),
    }))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Business Name</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>Industry</label>
          <input className={inputCls} value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Timezone</label>
        <input className={inputCls} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="e.g. America/New_York" />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea className={`${inputCls} min-h-24 resize-none`} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={`${labelCls} mb-0`}>Services</label>
          <button onClick={addService} className="text-xs font-medium text-accent hover:text-accent-hover transition-colors duration-150">
            + Add service
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {form.services.map((s, i) => (
            <div key={i} className="rounded-card border border-border bg-bg p-3 flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <input
                  className={`${inputCls} flex-1`}
                  value={s.name}
                  onChange={e => updateService(i, 'name', e.target.value)}
                  placeholder="Service name"
                />
                <input
                  className={`${inputCls} w-24`}
                  value={s.price}
                  onChange={e => updateService(i, 'price', e.target.value)}
                  placeholder="$0"
                />
                <button
                  onClick={() => removeService(i)}
                  className="text-text-3 hover:text-status-escalated transition-colors duration-150"
                  aria-label="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <input
                className={inputCls}
                value={s.description ?? ''}
                onChange={e => updateService(i, 'description', e.target.value)}
                placeholder="Short description (optional)"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-button bg-accent px-5 py-2 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-accent-hover disabled:opacity-40 active:scale-95"
        >
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ── Agent tab ─────────────────────────────────────────────────────

function AgentTab({ settings }: { settings: Settings }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AgentProfile>(settings.agent)

  const save = useMutation({
    mutationFn: () => apiClient.patch('/admin/settings', { agent: form }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  })

  const fields: Array<{ field: keyof AgentProfile; label: string; hint: string }> = [
    { field: 'name',       label: 'Agent Name',  hint: 'How your agent introduces itself' },
    { field: 'greeting',   label: 'Greeting',    hint: 'First thing the agent says when picking up' },
    { field: 'farewell',   label: 'Farewell',    hint: 'Closing message before ending a call' },
    { field: 'fallback',   label: 'Fallback',    hint: 'Said when the agent cannot answer a question' },
    { field: 'holdPhrase', label: 'Hold Phrase', hint: 'Said while looking up information' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {fields.map(({ field, label, hint }) => (
        <div key={field}>
          <label className={labelCls}>{label}</label>
          <input
            className={inputCls}
            value={form[field]}
            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          />
          <p className="mt-1 text-xs text-text-3">{hint}</p>
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-button bg-accent px-5 py-2 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-accent-hover disabled:opacity-40 active:scale-95"
        >
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ── System tab ────────────────────────────────────────────────────

function SystemTab({ settings }: { settings: Settings }) {
  const qc = useQueryClient()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [areaCode, setAreaCode] = useState('')
  const [numbers, setNumbers] = useState<AvailableNumber[]>([])
  const [searching, setSearching] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  const releasePhone = useMutation({
    mutationFn: () => apiClient.delete('/admin/phone'),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  })

  const provisionPhone = useMutation({
    mutationFn: (phoneNumber: string) => apiClient.post('/admin/phone/provision', { phoneNumber }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      setNumbers([])
      setAreaCode('')
    },
  })

  async function searchNumbers() {
    setSearching(true)
    try {
      const res = await apiClient.get(`/admin/phone/search?areaCode=${areaCode}`)
      setNumbers(res.data as AvailableNumber[])
    } finally {
      setSearching(false)
    }
  }

  async function connectGoogleCalendar() {
    const googleAccount = user?.externalAccounts.find(a => a.provider === 'google')
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

  return (
    <div className="flex flex-col gap-6">

      {/* Phone number */}
      <section className="rounded-card border border-border bg-bg-surface p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-3">Phone Number</h3>
        {settings.business.phoneNumber ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-status-booked" />
              <span className="text-sm font-medium text-text-1">{formatPhone(settings.business.phoneNumber)}</span>
            </div>
            <button
              onClick={() => { if (confirm('Release this phone number? Your agent will stop receiving calls.')) releasePhone.mutate() }}
              disabled={releasePhone.isPending}
              className="text-xs text-status-escalated hover:underline disabled:opacity-40 transition-colors duration-150"
            >
              {releasePhone.isPending ? 'Releasing…' : 'Release number'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-2">No phone number provisioned. Search by area code to get one.</p>
            <div className="flex gap-2">
              <input
                className={`${inputCls} w-36`}
                value={areaCode}
                onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="Area code (415)"
                maxLength={3}
              />
              <button
                onClick={searchNumbers}
                disabled={areaCode.length !== 3 || searching}
                className="rounded-button border border-border px-4 py-2 text-xs font-medium text-text-1 hover:bg-bg-hover disabled:opacity-40 transition-colors duration-150"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
            {numbers.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {numbers.map(n => (
                  <button
                    key={n.id}
                    onClick={() => provisionPhone.mutate(n.e164_format)}
                    disabled={provisionPhone.isPending}
                    className="flex items-center justify-between rounded-button border border-border px-4 py-3 text-left text-sm hover:bg-bg-hover transition-colors duration-150 disabled:opacity-40"
                  >
                    <span className="font-medium text-text-1">{formatPhone(n.e164_format)}</span>
                    <span className="text-xs text-text-2">{n.locality}, {n.region}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Google Calendar */}
      <section className="rounded-card border border-border bg-bg-surface p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-3">Google Calendar</h3>
        {settings.business.googleCalendarId ? (
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-status-booked" />
            <div>
              <p className="text-sm font-medium text-text-1">Connected</p>
              <p className="text-xs text-text-2">{settings.business.googleCalendarId}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-2">Connect Google Calendar to let your agent check availability and book appointments.</p>
            <button
              onClick={connectGoogleCalendar}
              className="self-start flex items-center gap-2 rounded-button border border-border px-4 py-2 text-sm font-medium text-text-1 hover:bg-bg-hover transition-colors duration-150"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              Connect Google Calendar
            </button>
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-card border border-border bg-bg-surface p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-status-escalated">Danger Zone</h3>
        {!deleteConfirm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-1">Delete Account</p>
              <p className="text-xs text-text-2">Permanently remove your account and all associated data.</p>
            </div>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="rounded-button border border-status-escalated px-4 py-2 text-xs font-medium text-status-escalated hover:bg-status-escalated hover:text-white transition-colors duration-150"
            >
              Delete Account
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-1">
              Type <span className="font-semibold">DELETE</span> to confirm. This cannot be undone.
            </p>
            <input
              className={inputCls}
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="Type DELETE to confirm"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteInput('') }}
                className="rounded-button border border-border px-4 py-2 text-xs font-medium text-text-2 hover:bg-bg-hover transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                disabled={deleteInput !== 'DELETE'}
                onClick={async () => {
                  await apiClient.delete('/admin/account')
                  await signOut()
                }}
                className="rounded-button bg-status-escalated px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity duration-150"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────────────

type SettingsTab = 'business' | 'agent' | 'system'

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('business')

  const { data: settings, isLoading } = useQuery({
    queryKey: keys.settings,
    queryFn: fetchers.settings,
  })

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'business', label: 'Business' },
    { id: 'agent',    label: 'Agent' },
    { id: 'system',   label: 'System' },
  ]

  return (
    <div className="flex flex-col px-8 py-6 min-h-full max-w-2xl">
      <h1 className="text-xl font-semibold text-text-1 mb-6">Settings</h1>

      {/* Tab bar */}
      <div className="flex border-b border-border mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative pb-3 pt-1 text-sm font-medium transition-colors duration-150 mr-7 ${
              tab === t.id ? 'text-text-1' : 'text-text-2 hover:text-text-1'
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-10 animate-pulse rounded-button bg-bg-hover" />)}
        </div>
      )}

      {settings && tab === 'business' && <BusinessTab key="business" settings={settings} />}
      {settings && tab === 'agent'    && <AgentTab    key="agent"    settings={settings} />}
      {settings && tab === 'system'   && <SystemTab   key="system"   settings={settings} />}
    </div>
  )
}
