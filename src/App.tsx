import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardPage } from '@/pages/dashboard'
import { JiraPage } from '@/pages/jira'
import { TodosPage } from '@/pages/todos'
import { InboxPage } from '@/pages/inbox'
import { JournalPage } from '@/pages/journal'
import { SettingsPage } from '@/pages/settings'
import { ProductivityPage } from '@/pages/productivity'
import { ActivityPage } from '@/pages/activity'
import { GitLabPage } from '@/pages/gitlab'
import { GitLabMRPage } from '@/pages/gitlab-mr'
import { DocumentsPage } from '@/pages/documents'
import { OpenCodePage } from '@/pages/opencode'
import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/jira'

export function App() {
  // Auto-sync non-secret env values into settings store on startup
  useEffect(() => {
    fetchServerSettings()
      .then((env) => {
        const { updateJira, updateGitlab, updateMessages, settings } = useSettingsStore.getState()
        updateJira({
          baseUrl: env.jira.baseUrl || settings.jira.baseUrl,
          email: env.jira.email || settings.jira.email,
          projectKey: env.jira.projectKey || settings.jira.projectKey,
        })
        if (env.gitlab?.baseUrl) {
          updateGitlab({ baseUrl: env.gitlab.baseUrl })
        }
        if (env.messages.customEndpoint) {
          updateMessages({ customEndpoint: env.messages.customEndpoint })
        }
      })
      .catch(() => {/* backend not running */})
  }, [])

  // Cmd+J to open journal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        window.location.href = '/journal'
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/jira" element={<JiraPage />} />
        <Route path="/todos" element={<TodosPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/productivity" element={<ProductivityPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/gitlab" element={<GitLabPage />} />
        <Route path="/gitlab/mr/:projectId/:iid" element={<GitLabMRPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:folder" element={<DocumentsPage />} />
        <Route path="/documents/:folder/:doc" element={<DocumentsPage />} />
        <Route path="/opencode" element={<OpenCodePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
