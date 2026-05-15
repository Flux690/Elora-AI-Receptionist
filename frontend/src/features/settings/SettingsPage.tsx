import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/layout/PageContainer'
import { keys, fetchers } from '@/lib/queries'
import { BusinessTab } from './BusinessTab'
import { AgentTab } from './AgentTab'
import { AccountTab } from './AccountTab'

const TAB_IDS = ['business', 'agent', 'account'] as const
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
    <PageContainer size="md">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Settings</h1>

      <Tabs
        value={tab}
        onValueChange={(v) => isTabId(v) && setTab(v)}
        className="gap-6"
      >
        <TabsList variant="line" className="w-full justify-start border-b border-border rounded-none">
          <TabsTrigger value="business">Business</TabsTrigger>
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
