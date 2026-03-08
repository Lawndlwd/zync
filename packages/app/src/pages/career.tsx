import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Briefcase, UserCircle } from 'lucide-react'
import { JobsPage } from './jobs'
import { ProfilePage } from './profile'

export function CareerPage() {
  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="jobs" className="flex h-full flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Career</h1>
            <p className="text-sm text-zinc-500">Job search & profile management</p>
          </div>
          <TabsList>
            <TabsTrigger value="jobs" className="gap-2">
              <Briefcase size={14} />
              Job Search
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <UserCircle size={14} />
              Profile & CV
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="jobs" className="flex-1 overflow-hidden mt-0">
          <JobsPage />
        </TabsContent>
        <TabsContent value="profile" className="flex-1 overflow-hidden mt-0">
          <ProfilePage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
