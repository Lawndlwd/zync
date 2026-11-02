import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../api'
import { Button } from '../components/Button'
import { useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import {
  draftOf,
  draftWeightKg,
  type ProfileDraft,
  profileOf,
  SETUP_STEPS,
  stepProblem,
  TRAINING_IDENTITY,
} from '../helpers/training'
import { trainingUrl } from '../helpers/urls'
import { useIdentities } from '../hooks/useIdentities'
import { useTrainingPlan } from '../hooks/useTrainingPlan'
import type { TrainingProfile } from '../types/training'
import { SetupEquipment } from './SetupEquipment'
import { SetupFinish } from './SetupFinish'
import { SetupGoal } from './SetupGoal'
import { SetupSchedule } from './SetupSchedule'
import { SetupYou } from './SetupYou'

/** The setup form, four steps and a last look; `profile` fills it in when it is edited again. */
export function SetupWizard({ ws, profile }: { ws: string; profile: TrainingProfile | null }) {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const plan = useTrainingPlan(ws)
  const identities = useIdentities(ws)
  const [d, setD] = useState<ProfileDraft>(() => draftOf(profile))
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [identity, setIdentity] = useState(true)
  const [busy, setBusy] = useState<'ai' | 'self' | null>(null)
  const set = (patch: Partial<ProfileDraft>) => {
    setD((x) => ({ ...x, ...patch }))
    setError('')
  }
  const identityExists = (identities.data ?? []).some((i) => i.signals.some((s) => 'workout' in s))
  const last = SETUP_STEPS.length - 1

  const go = (to: number) => {
    // Forward only past complete steps; back is always fine.
    for (let s = step; s < to; s++) {
      const problem = stepProblem(s, d, new Date().getFullYear())
      if (problem) {
        setStep(s)
        return setError(problem)
      }
    }
    setError('')
    setStep(to)
  }

  const save = async (mode: 'ai' | 'self') => {
    const input = profileOf(d)
    if (!input) return setError('Some answers are missing — go back and fill them in.')
    setBusy(mode)
    try {
      await api.saveTrainingProfile(ws, input)
      const kg = draftWeightKg(d)
      if (kg !== undefined) await api.logBodyWeight(ws, kg)
      if (identity && !identityExists) {
        const experiment = (identities.data ?? []).some((i) => i.stage === 'experiment')
        try {
          await api.createIdentity(ws, {
            statement: TRAINING_IDENTITY,
            action: 'Train',
            small: 'Ten minutes of movement',
            stage: experiment ? 'trying' : 'experiment',
            signals: [{ workout: {} }],
            ...(input.sessionMinutes ? { minutes: input.sessionMinutes } : {}),
          })
        } catch (err) {
          toast(`Training is set up, but the identity wasn’t created: ${errorMessage(err)}`, 'bad')
        }
      }
      await qc.invalidateQueries({ queryKey: ['training', ws] })
      await qc.invalidateQueries({ queryKey: ['becoming', ws] })
      if (mode === 'ai') {
        await plan.start()
        void navigate(trainingUrl(ws))
      } else void navigate(trainingUrl(ws, 'routines'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="col g20" style={{ maxWidth: 720 }}>
      <ol className="tr-steps" aria-label="Setup steps">
        {SETUP_STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'on' : i < step ? 'past' : undefined}>
            <Button
              size="sm"
              variant={i === step ? 'primary' : 'ghost'}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => go(i)}
            >
              {i + 1} · {label}
            </Button>
          </li>
        ))}
      </ol>

      <section className="card col g16" aria-label={SETUP_STEPS[step]}>
        {step === 0 && <SetupYou d={d} set={set} />}
        {step === 1 && <SetupGoal d={d} set={set} />}
        {step === 2 && <SetupEquipment d={d} set={set} />}
        {step === 3 && <SetupSchedule d={d} set={set} />}
        {step === last && (
          <SetupFinish d={d} identity={identity} identityExists={identityExists} onIdentity={setIdentity} />
        )}
        {error && <span className="help err">{error}</span>}
      </section>

      <div className="row between g8 wrap">
        <Button disabled={step === 0} onClick={() => go(step - 1)}>
          [←] Back
        </Button>
        {step < last ? (
          <Button variant="primary" onClick={() => go(step + 1)}>
            Next [→]
          </Button>
        ) : (
          <div className="row g8 wrap">
            <Button busy={busy === 'self'} disabled={busy !== null} onClick={() => void save('self')}>
              {profile ? 'Save' : 'I’ll build routines myself'}
            </Button>
            <Button variant="primary" busy={busy === 'ai'} disabled={busy !== null} onClick={() => void save('ai')}>
              [↗] {profile ? 'Save and rebuild my plan with AI' : 'Build my plan with AI'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
