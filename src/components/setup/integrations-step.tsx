import { useSetupStore } from '@/store/setup'
import { Ticket, GitMerge, Send, MessageCircle, Mail, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  category: string
}

const integrations: Integration[] = [
  // Project Management
  { id: 'jira', name: 'Jira', description: 'Track issues, sprints, and boards', icon: Ticket, color: 'text-blue-400', category: 'Project Management' },
  { id: 'gitlab', name: 'GitLab', description: 'Merge requests, pipelines, and repos', icon: GitMerge, color: 'text-violet-400', category: 'Project Management' },
  // Communication
  { id: 'telegram', name: 'Telegram', description: 'Chat with your AI agent on the go', icon: Send, color: 'text-sky-400', category: 'Communication' },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Receive AI responses via WhatsApp', icon: MessageCircle, color: 'text-emerald-400', category: 'Communication' },
  { id: 'gmail', name: 'Gmail', description: 'Read and reply to emails via OAuth', icon: Mail, color: 'text-red-400', category: 'Communication' },
]

const categories = [...new Set(integrations.map((i) => i.category))]

export function IntegrationsStep() {
  const { selectedIntegrations, toggleIntegration, configuredIntegrations } = useSetupStore()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Choose Integrations</h2>
        <p className="text-zinc-400 text-sm">
          Select the services you want to connect. You can always add more later in Settings.
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">{category}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {integrations
                .filter((i) => i.category === category)
                .map((integration) => {
                  const selected = selectedIntegrations.includes(integration.id)
                  const configured = configuredIntegrations[integration.id]
                  const Icon = integration.icon
                  return (
                    <button
                      key={integration.id}
                      onClick={() => toggleIntegration(integration.id)}
                      className={cn(
                        'flex items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all',
                        selected
                          ? 'border-indigo-500/40 bg-indigo-500/10 ring-1 ring-indigo-500/20'
                          : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        selected ? 'bg-indigo-500/20' : 'bg-white/[0.06]'
                      )}>
                        <Icon className={cn('h-5 w-5', selected ? 'text-indigo-400' : integration.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-200">{integration.name}</p>
                          {configured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Configured
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{integration.description}</p>
                      </div>
                      <div className={cn(
                        'h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                        selected ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-600'
                      )}>
                        {selected && (
                          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
