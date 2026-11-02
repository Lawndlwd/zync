/** Resolves after `ms` milliseconds. */
export const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
