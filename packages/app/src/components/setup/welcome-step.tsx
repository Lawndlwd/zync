import { Rocket, Zap, Shield, Bot } from 'lucide-react'

const highlights = [
  { icon: Zap, label: 'Jira & GitLab', desc: 'Track issues and merge requests in one place' },
  { icon: Bot, label: 'AI Agent', desc: 'Chat with an AI that knows your tools' },
  { icon: Shield, label: 'Encrypted Vault', desc: 'Your API keys stay safe locally' },
]

export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20">
        <Rocket className="h-8 w-8 text-indigo-400" />
      </div>

      <h2 className="text-3xl font-bold text-zinc-100 mb-3">
        Welcome to Zync
      </h2>
      <p className="text-zinc-400 mb-10 text-base leading-relaxed">
        Your personal AI dashboard. Let's get you set up in a few quick steps — you can always change these later in Settings.
      </p>

      <div className="w-full space-y-4">
        {highlights.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-4 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
              <Icon className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">{label}</p>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
