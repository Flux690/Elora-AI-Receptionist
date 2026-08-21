import { useQuery } from '@tanstack/react-query'
import { PageContainer } from '@/layout/PageContainer'
import { keys, fetchers } from '@/lib/queries'
import { OverviewHeader } from './OverviewCard'
import { CallStats } from './CallStats'
import { CallsTable } from './CallsTable'

export default function HomePage() {
  const { data: settings } = useQuery({
    queryKey: keys.settings,
    queryFn: fetchers.settings,
  })

  return (
    <PageContainer size="page">
      <div className="flex flex-col gap-8">
        <OverviewHeader settings={settings} />

        <CallStats />

        <CallsTable />
      </div>
    </PageContainer>
  )
}
