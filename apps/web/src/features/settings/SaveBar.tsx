import { Button } from '@/components/ui/button'

interface SaveBarProps {
  /** What is unsaved, in the reader's terms: "business name", "2 services". */
  changes: string[]
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}

/**
 * One bar per tab, at the foot, shown once anything is dirty. It names what is
 * unsaved so pressing Save is never a guess.
 */
export function SaveBar({ changes, saving, onSave, onDiscard }: SaveBarProps) {
  if (changes.length === 0) return null

  const count = changes.length
  return (
    <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border bg-card px-5 py-3 md:left-(--container-sidebar)">
      <div className="mx-auto flex max-w-form items-center justify-between gap-4">
        <p className="min-w-0 truncate text-muted-foreground">
          <span className="font-medium text-foreground">
            {count} unsaved {count === 1 ? 'change' : 'changes'}
          </span>
          {': '}
          {changes.join(', ')}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
