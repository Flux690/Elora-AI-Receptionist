import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Inbox, Phone, CalendarDays, Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { NavUser } from './NavUser'

const mainNav = [
  { label: 'Overview', icon: LayoutDashboard, to: '/', end: true },
  { label: 'Inbox', icon: Inbox, to: '/inbox', end: false },
  { label: 'Calls', icon: Phone, to: '/calls', end: false },
  { label: 'Appointments', icon: CalendarDays, to: '/appointments', end: false },
]

const bottomNav = [
  { label: 'Settings', icon: Settings, to: '/settings', end: false },
]

export default function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <span className="font-heading text-lg font-semibold tracking-tight">Receptionist</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {mainNav.map(({ label, icon: Icon, to, end }) => (
              <SidebarMenuItem key={to}>
                <NavLink to={to} end={end}>
                  {({ isActive }) => (
                    <SidebarMenuButton isActive={isActive}>
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  )}
                </NavLink>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            {bottomNav.map(({ label, icon: Icon, to, end }) => (
              <SidebarMenuItem key={to}>
                <NavLink to={to} end={end}>
                  {({ isActive }) => (
                    <SidebarMenuButton isActive={isActive}>
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  )}
                </NavLink>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
