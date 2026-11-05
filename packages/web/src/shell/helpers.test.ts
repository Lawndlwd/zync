import { describe, expect, it } from 'vitest'

import { wsUrl } from '../helpers/urls'
import { isTabPath } from './helpers'

describe('isTabPath', () => {
  it('knows the sections the tab bar shows, including their sub-pages', () => {
    expect(isTabPath('me', wsUrl('me', 'overview'))).toBe(true)
    expect(isTabPath('me', wsUrl('me', 'chat'))).toBe(true)
    expect(isTabPath('me', `${wsUrl('me', 'boards')}/work`)).toBe(true)
  })

  it('leaves everything else to "More"', () => {
    expect(isTabPath('me', wsUrl('me', 'files'))).toBe(false)
    expect(isTabPath('me', wsUrl('me', 'training'))).toBe(false)
  })
})
