import { Outlet } from 'react-router-dom'
import { useAuthInterceptor } from '@/hooks/useAuthInterceptor'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar'

export default function AppLayout() {
  useAuthInterceptor()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
