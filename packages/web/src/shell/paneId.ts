import { createContext, useContext } from 'react'

/** Which side a view is rendered in: 'main', or a split pane's id. */
export const PaneIdContext = createContext<string>('main')

export const usePaneId = () => useContext(PaneIdContext)
