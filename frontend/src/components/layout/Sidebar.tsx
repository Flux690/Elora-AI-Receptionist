import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/escalations', label: 'Escalations' },
  { to: '/calls', label: 'Calls' },
  { to: '/knowledge', label: 'Knowledge' },
  { to: '/settings', label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-sm font-semibold text-sidebar-foreground">Elora</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
