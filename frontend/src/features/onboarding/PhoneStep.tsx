import { useEffect, useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import type { AvailableNumber } from '@receptionist/shared'
import { apiClient } from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatPhone } from '@/lib/formatters'

interface PhoneStepProps {
  selectedNumber: string | null
  onSelect: (e164: string) => void
  onBack: () => void
  onFinish: () => void
  submitting: boolean
}

export function PhoneStep({ selectedNumber, onSelect, onBack, onFinish, submitting }: PhoneStepProps) {
  const [defaultNumber, setDefaultNumber] = useState<AvailableNumber | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMore, setShowMore] = useState(false)
  const [areaCode, setAreaCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [moreNumbers, setMoreNumbers] = useState<AvailableNumber[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)

  const fetchDefault = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<AvailableNumber[]>('/onboarding/phone/search')
      if (res.data.length > 0) {
        setDefaultNumber(res.data[0])
        onSelect(res.data[0].e164_format)
      }
    } catch {
      /* ignore — user can search manually */
    } finally {
      setLoading(false)
    }
    // onSelect is stable from parent; don't re-run on its identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchDefault()
  }, [fetchDefault])

  async function handleSearch() {
    if (areaCode.length !== 3 || searching) return
    setSearching(true)
    setSearchError(null)
    try {
      const res = await apiClient.get<AvailableNumber[]>(
        `/onboarding/phone/search?areaCode=${areaCode}`,
      )
      if (res.data.length > 0) {
        setMoreNumbers(res.data)
      } else {
        setSearchError('No numbers found for this area code.')
        setMoreNumbers([])
      }
    } catch {
      setSearchError('Could not search. Try again.')
    } finally {
      setSearching(false)
    }
  }

  const displayNumber = selectedNumber ?? defaultNumber?.e164_format ?? null
  const displayLocation =
    moreNumbers.find((n) => n.e164_format === selectedNumber) ?? defaultNumber

  return (
    <div className="space-y-5">
      <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-6">
        {loading ? (
          <Skeleton className="h-9 w-48" />
        ) : displayNumber ? (
          <>
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {formatPhone(displayNumber)}
            </p>
            {displayLocation && (
              <p className="text-sm text-muted-foreground">
                {displayLocation.locality}, {displayLocation.region}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No number available. Try searching below.
          </p>
        )}
      </div>

      {!showMore && !loading && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="w-full text-center text-sm font-medium text-primary hover:text-primary-hover transition-colors"
        >
          Choose a different number
        </button>
      )}

      {showMore && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Search by US area code
            </p>
            <div className="flex gap-2">
              <Input
                value={areaCode}
                onChange={(e) =>
                  setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                }}
                placeholder="e.g. 415"
                maxLength={3}
                className="w-24 text-center font-semibold"
              />
              <Button
                variant="outline"
                onClick={handleSearch}
                disabled={areaCode.length !== 3 || searching}
              >
                <Search className="size-3.5" />
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </div>
          </div>

          {searchError && <p className="text-xs text-destructive">{searchError}</p>}

          {moreNumbers.length > 0 && (
            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
              {moreNumbers.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onSelect(n.e164_format)}
                  type="button"
                  className={cn(
                    'flex items-center justify-between rounded-md border px-4 py-2.5 text-sm transition-colors',
                    selectedNumber === n.e164_format
                      ? 'border-primary bg-primary-subtle text-foreground'
                      : 'border-border bg-card text-foreground hover:bg-muted',
                  )}
                >
                  <span className="font-medium">{formatPhone(n.e164_format)}</span>
                  <span className="text-xs text-muted-foreground">
                    {n.locality}, {n.region}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onFinish}
          disabled={!selectedNumber || loading || submitting}
          className="flex-1"
        >
          {submitting ? 'Setting up your account…' : 'Finish setup'}
        </Button>
      </div>
    </div>
  )
}
