import { Mic, Phone } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPhone } from '@/lib/formatters'
import type { AppSettings } from '@/lib/settings-types'

interface OverviewCardProps {
  settings: AppSettings | undefined
}

export function OverviewCard({ settings }: OverviewCardProps) {
  if (!settings) {
    return (
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-1.5 h-4 w-32" />
        <Skeleton className="mt-5 h-20 w-full rounded-lg" />
      </div>
    )
  }

  const { business, agent } = settings

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">{business.name}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">{business.industry}</p>

      <Card className="mt-5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">
              {agent.name || 'Unnamed Agent'}
            </p>
            {business.phoneNumber && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5" />
                {formatPhone(business.phoneNumber)}
              </p>
            )}
          </div>
          <Button variant="default" size="lg">
            <Mic className="size-4" />
            Test Agent
          </Button>
        </div>
      </Card>
    </div>
  )
}
