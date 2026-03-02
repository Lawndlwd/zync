import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetupStore } from '@/store/setup'
import { getSetupStatus, completeSetup } from '@/services/setup'
import { WelcomeStep } from '@/components/setup/welcome-step'
import { VaultStep } from '@/components/setup/vault-step'
import { IntegrationsStep } from '@/components/setup/integrations-step'
import { ConfigureStep } from '@/components/setup/configure-step'
import { DoneStep } from '@/components/setup/done-step'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEP_LABELS = ['Welcome', 'Vault', 'Integrations', 'Configure', 'Done']

export function SetupPage() {
  const navigate = useNavigate()
  const { currentStep, setStep, reset, setConfigured, preSelectConfigured } = useSetupStore()
  const [vaultStatus, setVaultStatus] = useState<'available' | 'uninitialized'>('uninitialized')
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    getSetupStatus()
      .then((status) => {
        setVaultStatus(status.vaultStatus)
        setConfigured(status.configuredIntegrations, status.configuredSettings)
        preSelectConfigured(status.configuredIntegrations)
      })
      .catch(() => {})
  }, [currentStep])

  const isLastStep = currentStep === STEP_LABELS.length - 1
  const canSkip = currentStep >= 2 && !isLastStep

  const handleNext = () => {
    if (isLastStep) {
      handleFinish()
    } else {
      setStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setStep(currentStep - 1)
  }

  const handleSkip = () => {
    setStep(STEP_LABELS.length - 1)
  }

  const handleFinish = async () => {
    setFinishing(true)
    try {
      await completeSetup()
      reset()
      navigate('/', { replace: true })
    } catch {
      // Still navigate even if the API call fails
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[500px] w-[600px] rounded-full bg-indigo-500/[0.07] blur-[120px]" />
        <div className="absolute top-[30%] -right-[5%] h-[500px] w-[500px] rounded-full bg-emerald-500/[0.07] blur-[120px]" />
      </div>

      {/* Progress bar */}
      <div className="relative z-10 border-b border-white/[0.06] bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <span className="text-sm font-medium text-zinc-400">Setup</span>
          <div className="flex items-center gap-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <button
                  onClick={() => i <= currentStep && setStep(i)}
                  disabled={i > currentStep}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                    i === currentStep
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : i < currentStep
                        ? 'bg-white/[0.06] text-zinc-400 hover:text-zinc-300 cursor-pointer'
                        : 'text-zinc-600'
                  )}
                >
                  <span className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
                    i === currentStep ? 'bg-indigo-500 text-white' :
                    i < currentStep ? 'bg-zinc-600 text-zinc-300' : 'bg-zinc-800 text-zinc-600'
                  )}>
                    {i < currentStep ? '\u2713' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
                {i < STEP_LABELS.length - 1 && (
                  <div className={cn(
                    'h-px w-6',
                    i < currentStep ? 'bg-indigo-500/40' : 'bg-white/[0.06]'
                  )} />
                )}
              </div>
            ))}
          </div>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Step content */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        {currentStep === 0 && <WelcomeStep />}
        {currentStep === 1 && <VaultStep vaultStatus={vaultStatus} />}
        {currentStep === 2 && <IntegrationsStep />}
        {currentStep === 3 && <ConfigureStep />}
        {currentStep === 4 && <DoneStep />}
      </div>

      {/* Navigation */}
      <div className="relative z-10 border-t border-white/[0.06] bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {canSkip && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <SkipForward className="h-3 w-3" />
                Skip for now
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={handleNext}
              disabled={finishing}
            >
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
