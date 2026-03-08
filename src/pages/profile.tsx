import { useState, useEffect, useMemo } from 'react'
import { useProfile, useUpdateProfile } from '@/hooks/useJobs'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileEditor } from '@/components/profile/profile-editor'
import { ThemeCustomizer } from '@/components/profile/theme-customizer'
import { CvPreview } from '@/components/profile/cv-preview'
import { UploadPrompt } from '@/components/profile/upload-prompt'
import { DEFAULT_THEME } from '@/lib/cv-themes'
import type { Profile, CvTheme } from '@/types/jobs'
import { UserCircle, FileText, Palette } from 'lucide-react'

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export function ProfilePage() {
  const { data: profile, isLoading } = useProfile()
  const updateMutation = useUpdateProfile()
  const [localProfile, setLocalProfile] = useState<Profile | null>(null)
  const [theme, setTheme] = useState<CvTheme>(DEFAULT_THEME)

  // Sync server profile to local state on first load
  useEffect(() => {
    if (profile && !localProfile) {
      setLocalProfile(profile)
      if (profile.cv_theme) setTheme(profile.cv_theme)
    }
  }, [profile, localProfile])

  const debouncedSave = useMemo(
    () => debounce((data: Partial<Profile>) => updateMutation.mutate(data), 1000),
    [] // stable reference
  )

  const handleChange = (updates: Partial<Profile>) => {
    setLocalProfile(prev => prev ? { ...prev, ...updates } : prev)
    debouncedSave(updates)
  }

  const handleThemeChange = (newTheme: CvTheme) => {
    setTheme(newTheme)
    debouncedSave({ cv_theme: newTheme })
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><span className="text-zinc-500">Loading...</span></div>
  }

  if (!localProfile) {
    return <UploadPrompt />
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-6 py-3">
        <UserCircle size={22} className="text-teal-400" />
        <h1 className="text-xl font-semibold text-zinc-100">Profile & CV Builder</h1>
        {updateMutation.isPending && <span className="text-xs text-zinc-500">Saving...</span>}
      </div>

      {/* Two-panel layout */}
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={40} minSize={30}>
            <Tabs defaultValue="profile" className="flex h-full flex-col">
              <div className="border-b border-white/[0.08] px-4">
                <TabsList className="bg-transparent h-10">
                  <TabsTrigger value="profile" className="gap-1.5 data-[state=active]:bg-white/[0.06]">
                    <FileText size={14} />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger value="theme" className="gap-1.5 data-[state=active]:bg-white/[0.06]">
                    <Palette size={14} />
                    Theme
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="profile" className="mt-0 min-h-0 flex-1">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <ProfileEditor profile={localProfile} onChange={handleChange} />
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="theme" className="mt-0 min-h-0 flex-1">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <ThemeCustomizer theme={theme} onChange={handleThemeChange} />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={60} minSize={35}>
            <CvPreview profile={localProfile} theme={theme} onChange={handleChange} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
