import { useHotkeys } from './useHotkeys'

/**
 * Side panels: Esc closes, ⌘/Ctrl+↵ submits (when `onSubmit` is given). Esc is left alone while a
 * floating layer (menu, popover, date picker) is open, or when something already handled it.
 */
export function usePanelEscape(onClose: () => void, { onSubmit }: { onSubmit?: () => void } = {}) {
  useHotkeys((e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.floating')) onClose()
    if (onSubmit && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  })
}
