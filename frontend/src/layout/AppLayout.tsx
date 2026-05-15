import { Suspense } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/react'
import { useQuery } from '@tanstack/react-query'
import {
  Home,
  AlertCircle,
  Calendar,
  BookOpen,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react'
import { keys, fetchers } from '@/lib/queries'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { RouteSkeleton } from './RouteSkeleton'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',              label: 'Home',         icon: Home,        end: true },
  { to: '/escalations',   label: 'Escalations',  icon: AlertCircle },
  { to: '/appointments',  label: 'Appointments', icon: Calendar },
  { to: '/knowledge',     label: 'Knowledge',    icon: BookOpen },
]

function isPathActive(pathname: string, item: NavItem): boolean {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(item.to + '/')
}

export default function AppLayout() {
  const { pathname } = useLocation()
  const { data: pendingEscalations } = useQuery({
    queryKey: keys.escalations('pending'),
    queryFn: () => fetchers.escalations('pending'),
  })
  const { user } = useUser()
  const { signOut } = useClerk()

  const pendingCount = pendingEscalations?.length ?? 0
  const firstName = user?.firstName || 'User'
  const avatarUrl = user?.imageUrl

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* Expanded row: logo + name on left, trigger on right.
              Collapsed: only the logo, centered on the icon-rail centerline. */}
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                D
              </div>
              <span className="truncate text-base font-semibold text-foreground group-data-[collapsible=icon]:hidden">
                DeskRoute
              </span>
            </div>
            <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
          </div>
          {/* Collapsed-only: trigger on its own row, centered. */}
          <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarTrigger />
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const active = isPathActive(pathname, item)
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        render={<Link to={item.to} />}
                        isActive={active}
                        tooltip={item.label}
                        className="text-sm"
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.to === '/escalations' && pendingCount > 0 && (
                        <SidebarMenuBadge className="bg-status-pending text-white text-[10px] font-bold">
                          {pendingCount}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/settings" />}
                isActive={pathname === '/settings'}
                tooltip="Settings"
                className="text-sm"
              >
                <SettingsIcon className="size-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Profile: avatar acts as the icon to share the nav centerline.
                Sign-out lives as a SidebarMenuAction — auto-hides when collapsed. */}
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={firstName}
                className="text-sm"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={firstName}
                    className="size-4 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="size-4 shrink-0 rounded-full bg-muted" />
                )}
                <span className="truncate">{firstName}</span>
              </SidebarMenuButton>
              <SidebarMenuAction
                onClick={() => signOut()}
                aria-label="Sign out"
              >
                <LogOut />
              </SidebarMenuAction>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="flex flex-col flex-1 overflow-auto">
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
