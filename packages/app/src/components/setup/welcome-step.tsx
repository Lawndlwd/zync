import { Bot, Rocket, Shield, Zap } from 'lucide-react'

const highlights = [
  { icon: Zap, label: 'Integrations', desc: 'Connect Telegram, WhatsApp, Gmail and more' },
  { icon: Bot, label: 'AI Agent', desc: 'Chat with an AI that knows your tools' },
  { icon: Shield, label: 'Encrypted Vault', desc: 'Your API keys stay safe locally' },
]

export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Rocket className="h-8 w-8 text-primary" />
      </div>

      <h2 className="text-3xl font-bold text-foreground mb-3">Welcome to Zync</h2>
      <p className="text-muted-foreground mb-10 text-base leading-relaxed">
        Your personal AI dashboard. Let's get you set up in a few quick steps — you can always change these later in
        Settings.
      </p>

      <div className="w-full space-y-4">
        {highlights.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-3xl border border-border bg-card px-5 py-4 text-left border border-border"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
