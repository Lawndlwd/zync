export type AuthStatus = {
  authenticated: boolean
  /** No passkey registered yet: the sign-in page asks for the setup code instead. */
  setupRequired: boolean
  recoveryCodesLeft?: number
}

export type Passkey = {
  id: string
  name: string
  createdAt: number
  lastUsedAt: number | null
}

/** A signed-in browser. */
export type AuthSession = {
  id: string
  createdAt: number
  lastSeenAt: number
  ip: string
  userAgent: string
  current: boolean
}
