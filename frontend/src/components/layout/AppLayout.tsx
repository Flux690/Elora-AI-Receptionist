import { Outlet } from 'react-router-dom'
import { useAuthInterceptor } from '@/hooks/useAuthInterceptor'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppLayout() {
  useAuthInterceptor()

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
