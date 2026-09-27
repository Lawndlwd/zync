export type StepId = 'page' | 'board' | 'ai-card' | 'job' | 'memory' | 'palette'

/** One "Get started" mission. `done` comes from what is really in the workspace. */
export type Step = {
  id: StepId
  title: string
  done: boolean
}

/** A spotlight on one control: the element matching `target`, with a short explanation. */
export type Tip = {
  target: string
  title: string
  body: string
}

/** Where the guide goes to show a step: the page to open, then the control to spotlight there. */
export type StepGuide = {
  to: string
  tip: Tip
}

/** The checklist is open on the Overview, folded into the top bar, or gone for good. */
export type GuideState = 'open' | 'minimized' | 'closed'
