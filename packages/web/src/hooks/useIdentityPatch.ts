import { useQueryClient } from '@tanstack/react-query'

import { api } from '../api'
import { useToast } from '../components/Dialog'
import { errorMessage } from '../helpers/format'
import type { IdentityPatch } from '../types/becoming'

/** Save a change to an identity page, then refresh what Becoming shows. Errors become a toast. */
export function useIdentityPatch(ws: string) {
  const qc = useQueryClient()
  const toast = useToast()
  return async (file: string, patch: IdentityPatch) => {
    try {
      await api.updateIdentity(ws, file, patch)
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
    await qc.invalidateQueries({ queryKey: ['becoming', ws] })
  }
}
