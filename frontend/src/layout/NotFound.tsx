import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from './PageContainer'
import { EmptyState } from './EmptyState'

export function NotFound() {
  return (
    <PageContainer className="flex flex-1 flex-col">
      <EmptyState
        icon={Compass}
        title="That page does not exist"
        description="The link may be out of date, or the record may have been deleted."
        action={
          <Button render={<Link to="/" />} nativeButton={false}>
            Back to calls
          </Button>
        }
      />
    </PageContainer>
  )
}
