import { useState } from 'react'
import { useUser, useClerk } from '@clerk/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/apiClient'
import { Section, Field } from './Section'

export function AccountTab() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function saveProfile() {
    setSaving(true)
    try {
      await user?.update({ firstName, lastName })
      toast.success('Profile updated')
    } catch (err: unknown) {
      const message =
        (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ||
        'Failed to update profile'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      await apiClient.delete('/admin/account')
      await signOut()
    } catch {
      toast.error('Failed to delete account')
      setDeleting(false)
    }
  }

  return (
    <div>
      <Section title="You" lede="Your sign-in, not the business.">
        <div className="flex items-center gap-3.5">
          {user?.imageUrl && (
            <img
              src={user.imageUrl}
              alt=""
              className="size-11 rounded-full border border-border object-cover"
            />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-sm text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>

        <Field label="First name" htmlFor="first-name">
          <Input
            id="first-name"
            className="w-52"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </Field>

        <Field label="Last name" htmlFor="last-name">
          <Input
            id="last-name"
            className="w-52"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>

        <Field
          label="Email"
          help="Used to sign in. Changing it needs re-verification."
          htmlFor="email"
        >
          <Input
            id="email"
            className="w-[300px]"
            value={user?.primaryEmailAddress?.emailAddress ?? ''}
            readOnly
            disabled
          />
        </Field>

        <div className="flex justify-start pt-1">
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Section>

      <Section
        title="Delete account"
        lede="Removes the business, every call and recording, and releases your number. There is no undo."
      >
        {!deleteConfirm ? (
          <div>
            <Button variant="destructive" onClick={() => setDeleteConfirm(true)}>
              Delete account
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              Type <span className="font-semibold">DELETE</span> to confirm.
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-[300px]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={deleteInput !== 'DELETE' || deleting}
                onClick={deleteAccount}
              >
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirm(false)
                  setDeleteInput('')
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}
