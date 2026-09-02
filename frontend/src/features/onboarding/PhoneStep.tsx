import { useEffect, useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import type { AvailableNumber } from '@receptionist/shared'
import { apiClient } from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
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
        const first = res.data[0]
        if (first) {
          setDefaultNumber(first)
          onSelect(first.e164_format)
        }
      }
    } catch {
      /* Falls through to the manual area-code search. */
    } finally {
      setLoading(false)
    }
    // onSelect is stable from the parent, so its identity is not a dependency.
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
    <div className="flex flex-col gap-5">
      <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl bg-card p-6 shadow-control">
        {loading ? (
          <Skeleton className="h-9 w-48" />
        ) : displayNumber ? (
          <>
            <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {formatPhone(displayNumber)}
            </p>
            {displayLocation && (
              <p className="text-muted-foreground">
                {displayLocation.locality}, {displayLocation.region}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            No number available. Try searching below.
          </p>
        )}
      </div>

      {!showMore && !loading && (
        <Button
          variant="link"
          type="button"
          onClick={() => setShowMore(true)}
          className="w-full"
        >
          Choose a different number
        </Button>
      )}

      {showMore && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="font-medium text-muted-foreground">
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
                className="w-field-xs text-center font-medium tabular-nums"
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

          {searchError && <p className="text-destructive">{searchError}</p>}

          {/* Picking one of several is a single-choice control. */}
          {moreNumbers.length > 0 && (
            <ToggleGroup
              className="max-h-48 flex-col gap-1.5 overflow-y-auto"
              aria-label="Available numbers"
              value={selectedNumber ? [selectedNumber] : []}
              onValueChange={([number]) => number && onSelect(number)}
            >
              {moreNumbers.map((n) => (
                <ToggleGroupItem
                  key={n.id}
                  value={n.e164_format}
                  variant="row"
                  size="row"
                  className="flex-row items-center justify-between px-4 py-2.5 text-sm text-foreground"
                >
                  <span className="font-medium">{formatPhone(n.e164_format)}</span>
                  <span className="text-muted-foreground">
                    {n.locality}, {n.region}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
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
