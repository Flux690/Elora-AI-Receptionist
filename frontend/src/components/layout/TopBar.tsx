import { useLocation } from 'react-router-dom'
import { UserButton } from '@clerk/react'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/escalations': 'Escalations',
  '/calls': 'Calls',
  '/knowledge': 'Knowledge Base',
  '/settings': 'Settings',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? 'Dashboard'

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      <UserButton />
    </header>
  )
}
