import { useState } from 'react'
import { useUser, useClerk } from '@clerk/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { apiClient } from '@/lib/apiClient'

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {user?.imageUrl && (
          <img
            src={user.imageUrl}
            alt="Avatar"
            className="h-14 w-14 rounded-full object-cover border border-border"
          />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="first-name">First Name</Label>
          <Input
            id="first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last-name">Last Name</Label>
          <Input
            id="last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          value={user?.primaryEmailAddress?.emailAddress ?? ''}
          readOnly
          disabled
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={saveProfile} disabled={saving}>
          {saving ? 'Saving…' : 'Save Profile'}
        </Button>
      </div>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-destructive">
          Danger Zone
        </h3>
        {!deleteConfirm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete Account</p>
              <p className="text-xs text-muted-foreground">
                Permanently remove your account and all associated data.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
            >
              Delete Account
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              Type <span className="font-semibold">DELETE</span> to confirm. This cannot be undone.
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE to confirm"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteConfirm(false)
                  setDeleteInput('')
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteInput !== 'DELETE' || deleting}
                onClick={deleteAccount}
              >
                {deleting ? 'Deleting…' : 'Permanently Delete'}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
