import { useMediaQuery } from './useMediaQuery'

/** Phone-sized screen: the shell shows the tab bar and one view at a time. Same width as zync.css's narrow rules. */
export function useNarrow(): boolean {
  return useMediaQuery('(max-width: 820px)')
}
