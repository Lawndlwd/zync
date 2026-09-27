// zync's own window events, so `useEventListener` and `addEventListener` know them.
interface WindowEventMap {
  /** Settings changed one of the docked chat's preferences (shell/chatAppearance.ts). */
  'zync:chat-reload': Event
  /** A preference changed in this tab (shell/prefs.ts). */
  'zync:prefs': Event
}
