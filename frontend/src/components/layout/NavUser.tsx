import { useUser, useClerk } from '@clerk/react'
import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function NavUser() {
  const { user } = useUser()
  const { signOut, openUserProfile } = useClerk()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-sidebar-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName ?? 'User'}
                className="size-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <UserRound className="size-4 text-primary" />
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1 leading-tight">
              <span className="font-medium truncate">{user?.fullName ?? 'Account'}</span>
              <span className="text-xs text-muted-foreground truncate">
                {user?.primaryEmailAddress?.emailAddress}
              </span>
            </div>
            <ChevronsUpDown className="size-4 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={() => openUserProfile()}>
              <UserRound className="mr-2 size-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
