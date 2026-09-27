/** A run that didn't succeed: it failed or was stopped after the time limit. */
export const isFailedRun = (status: string | undefined) => status === 'failed' || status === 'timeout'
