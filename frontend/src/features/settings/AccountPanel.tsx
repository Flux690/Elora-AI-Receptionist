import { useMemo, useState } from 'react'
import { useUser, useClerk } from '@clerk/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiClient } from '@/lib/apiClient'
import { Section, Row } from './SettingsList'
import { SaveBar } from './SaveBar'

export function AccountPanel() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const changes = useMemo(() => {
    const out: string[] = []
    if (firstName !== (user?.firstName ?? '')) out.push('first name')
    if (lastName !== (user?.lastName ?? '')) out.push('last name')
    return out
  }, [firstName, lastName, user])

  async function saveProfile() {
    setSaving(true)
    try {
      await user?.update({ firstName, lastName })
      toast.success('Profile saved')
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ||
        'Could not save your profile. Try again.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Section title="Profile">
        <li className="flex items-center gap-3.5 p-4">
          {user?.imageUrl && (
            <img
              src={user.imageUrl}
              alt=""
              className="size-10 rounded-full border border-border object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-muted-foreground">{email}</p>
          </div>
        </li>
        <Row
          title="First name"
          description="Shown here only. Your agent never says it."
          htmlFor="first-name"
        >
          <Input
            id="first-name"
            className="w-field-md"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </Row>
        <Row
          title="Last name"
          description="Shown here only. Your agent never says it."
          htmlFor="last-name"
        >
          <Input
            id="last-name"
            className="w-field-md"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Row>
        <Row
          title="Email"
          description="You sign in with Google, so your email is managed there."
          htmlFor="email"
        >
          <Input id="email" className="w-field-lg" value={email} readOnly disabled />
        </Row>
      </Section>

      <Section title="Danger zone">
        <Row
          title="Delete this account"
          description="Removes the business, every call, and your phone number."
        >
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete account
          </Button>
        </Row>
      </Section>

      <SaveBar
        changes={changes}
        saving={saving}
        onSave={saveProfile}
        onDiscard={() => {
          setFirstName(user?.firstName ?? '')
          setLastName(user?.lastName ?? '')
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this account?"
        description="The business, every call, every recording and your phone number go with it. This cannot be undone."
        confirmLabel="Delete account"
        variant="destructive"
        onConfirm={async () => {
          try {
            await apiClient.delete('/admin/account')
            await signOut()
          } catch {
            toast.error('Could not delete the account. Try again.')
          }
        }}
      />
    </div>
  )
}
