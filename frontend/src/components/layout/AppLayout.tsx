import { Outlet, NavLink } from 'react-router-dom'
import { UserButton } from '@clerk/react'
import { useQuery } from '@tanstack/react-query'
import { keys, fetchers } from '@/lib/queries'

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Calls',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M13.5 10.5c-.8-.1-1.6-.3-2.3-.6-.3-.1-.6-.1-.9.1l-1.4 1.1c-1.5-.9-2.9-2.3-3.8-3.8L6.2 5.9c.2-.3.2-.6.1-.9C6 4.3 5.8 3.5 5.7 2.7c-.1-.5-.5-.9-1-.9H2.5c-.6 0-1 .5-1 1.1.2 6 4.8 10.6 10.8 10.8.6 0 1.1-.4 1.1-1v-2.2c0-.5-.4-.9-.9-1z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/escalations',
    label: 'Escalations',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2l1.5 3 3.3.5-2.4 2.3.6 3.3L8 9.5 5 11.1l.6-3.3L3.2 5.5l3.3-.5L8 2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/appointments',
    label: 'Appointments',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
        <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/knowledge',
    label: 'Knowledge',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 3h10v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.25"/>
        <path d="M3 3a1 1 0 011-1h8a1 1 0 011 1" stroke="currentColor" strokeWidth="1.25"/>
        <path d="M6 7h4M6 9.5h2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      </svg>
    ),
  },
] as const

export default function AppLayout() {
  const { data: settings } = useQuery({ queryKey: keys.settings, queryFn: fetchers.settings })
  const { data: pendingEscalations } = useQuery({
    queryKey: keys.escalations('pending'),
    queryFn: () => fetchers.escalations('pending'),
  })

  const pendingCount = pendingEscalations?.length ?? 0
  const businessName = settings?.business.name || 'Your Business'
  const industry = settings?.business.industry || ''

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <aside
        className="flex w-52 shrink-0 flex-col border-r"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-surface)' }}
      >
        {/* Brand */}
        <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-1)' }}>
            {businessName}
          </p>
          {industry && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-2)' }}>{industry}</p>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV_ITEMS.map(item => (
            <SidebarLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              badge={item.to === '/escalations' && pendingCount > 0 ? pendingCount : undefined}
              end={item.to === '/'}
            />
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="border-t px-2 py-3 space-y-0.5" style={{ borderColor: 'var(--color-border)' }}>
          <SidebarLink
            to="/settings"
            label="Settings"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13 8.5v-1l1.1-.9c.1-.1.1-.2.1-.3l-1-1.8c-.1-.1-.2-.2-.3-.1l-1.3.5c-.3-.2-.6-.4-.9-.5L10.5 3c0-.2-.1-.3-.3-.3H8.2c-.2 0-.3.1-.3.3l-.2 1.4c-.3.1-.6.3-.9.5l-1.3-.5c-.1 0-.3 0-.3.1l-1 1.8c-.1.1 0 .3.1.3L5.2 7.5v1L4 9.4c-.1.1-.1.2-.1.3l1 1.8c.1.1.2.2.3.1l1.3-.5c.3.2.6.4.9.5l.2 1.4c0 .2.1.3.3.3h2c.2 0 .3-.1.3-.3l.2-1.4c.3-.1.6-.3.9-.5l1.3.5c.1 0 .3 0 .3-.1l1-1.8c.1-.1 0-.3-.1-.3L13 8.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9.25" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            }
          />

          {/* Clerk UserButton */}
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-button"
            style={{ color: 'var(--color-text-1)' }}>
            <UserButton />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function SidebarLink({
  to,
  label,
  icon,
  badge,
  end,
}: {
  to: string
  label: string
  icon: React.ReactNode
  badge?: number
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-button px-2 py-2 text-sm font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-accent-light text-accent'
            : 'text-text-2 hover:bg-bg-hover hover:text-text-1'
        }`
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span
          className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
          style={{ backgroundColor: 'var(--color-status-escalated)' }}
        >
          {badge}
        </span>
      )}
    </NavLink>
  )
}
