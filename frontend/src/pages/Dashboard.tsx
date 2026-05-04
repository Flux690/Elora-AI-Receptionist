import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { keys, fetchers } from '@/lib/queries'

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: keys.metrics,
    queryFn: fetchers.metrics,
  })

  return (
    <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {isLoading ? '—' : data?.totalCalls ?? 0}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Pending Escalations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {isLoading ? '—' : data?.pendingEscalations ?? 0}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
