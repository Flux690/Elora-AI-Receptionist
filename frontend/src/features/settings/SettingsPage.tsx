import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/layout/PageContainer'
import { keys, fetchers } from '@/lib/queries'
import { BusinessTab } from './BusinessTab'
import { HoursTab } from './HoursTab'
import { AgentTab } from './AgentTab'
import { AccountTab } from './AccountTab'

const TAB_IDS = ['business', 'hours', 'agent', 'account'] as const
type TabId = (typeof TAB_IDS)[number]

function isTabId(v: string | null): v is TabId {
  return TAB_IDS.includes(v as TabId)
}

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab: TabId = isTabId(params.get('tab')) ? (params.get('tab') as TabId) : 'business'

  function setTab(next: TabId) {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    setParams(p, { replace: true })
  }

  const { data: settings, isLoading } = useQuery({
    queryKey: keys.settings,
    queryFn: fetchers.settings,
  })

  return (
    <PageContainer size="form">


      <Tabs
        value={tab}
        onValueChange={(v) => isTabId(v) && setTab(v)}
        className="gap-6"
      >
        {/* Sized to its labels and sitting top-left. It was a full-width bar
            with a rule under it, which drew a line across the page to hold four
            words. The active tab's own underline is the only marker needed. */}
        <TabsList variant="line" className="justify-start rounded-none">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="agent">Agent</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          {isLoading || !settings ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <BusinessTab settings={settings} />
          )}
        </TabsContent>

        <TabsContent value="hours">
          {isLoading || !settings ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <HoursTab settings={settings} />
          )}
        </TabsContent>

        <TabsContent value="agent">
          {isLoading || !settings ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <AgentTab settings={settings} />
          )}
        </TabsContent>

        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
