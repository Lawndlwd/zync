import { useState } from 'react'

import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useToast } from '../components/Dialog'
import { Segmented } from '../components/Segmented'
import { Select } from '../components/Select'
import { Toggle } from '../components/Toggle'
import {
  applyChatDefaults,
  chatScheme,
  type ChatSettings,
  chatSettings,
  chatTheme,
  chatThemes,
  DEFAULT_CHAT_THEME,
  followsZyncTheme,
  patchChatSettings,
  reloadChat,
  setChatScheme,
  setChatTheme,
  setFollowsZyncTheme,
} from '../shell/chatAppearance'
import { useShell } from '../shell/ShellContext'
import type { Theme } from '../types/shell'

const PANELS: Array<[keyof ChatSettings['general'], string]> = [
  ['showFileTree', 'File tree'],
  ['showNavigation', 'Navigation'],
  ['showSearch', 'Search'],
  ['showStatus', 'Status bar'],
  ['showTerminal', 'Terminal'],
  ['showReasoningSummaries', 'Reasoning summaries'],
]

/** opencode's own web UI preferences for the docked chat (this browser), edited in the zync style. */
export function ChatAppearance() {
  const shell = useShell()
  const toast = useToast()
  const [, bump] = useState(0)
  const themes = chatThemes()
  const settings = chatSettings()
  const follow = followsZyncTheme()
  const change = (fn: () => void) => {
    fn()
    bump((n) => n + 1)
    reloadChat()
  }
  const patch = (fn: (s: ChatSettings) => void) => change(() => patchChatSettings(fn))

  return (
    <Card title="AI chat appearance" meta="This browser · opencode’s own settings">
      <div className="kv chat-kv">
        <span className="k">Theme</span>
        <div className="row g8">
          <div style={{ width: 260, maxWidth: '100%' }}>
            <Select
              compact
              searchable
              ariaLabel="Chat theme"
              value={chatTheme() ?? DEFAULT_CHAT_THEME}
              options={themes.map((t) => ({
                value: t.id,
                label: t.name || t.id,
                text: `${t.name} ${t.id}`,
                hint: t.id === DEFAULT_CHAT_THEME ? 'default' : undefined,
              }))}
              onChange={(id) => change(() => setChatTheme(id))}
            />
          </div>
        </div>

        <span className="k">Light / dark</span>
        <div className="row g12 wrap">
          <span className="row g8">
            <Toggle
              label="Match zync's theme"
              checked={follow}
              onChange={(on) => change(() => setFollowsZyncTheme(on, shell.theme))}
            />
            <span className="small">Match zync ({shell.theme})</span>
          </span>
          {!follow && (
            <Segmented<Theme>
              label="Chat light or dark"
              value={chatScheme()}
              onChange={(v) => change(() => setChatScheme(v))}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          )}
        </div>

        {settings ? (
          <>
            <span className="k">Font size</span>
            <div style={{ width: 120 }}>
              <Select
                compact
                ariaLabel="Chat font size"
                value={String(settings.appearance.fontSize ?? 14)}
                options={[12, 13, 14, 15, 16, 17, 18].map((n) => ({ value: String(n), label: `${n} px` }))}
                onChange={(v) =>
                  patch((s) => {
                    s.appearance.fontSize = Number(v)
                  })
                }
              />
            </div>

            <span className="k" style={{ alignSelf: 'start', paddingTop: 4 }}>
              Panels
            </span>
            <div className="chat-toggles">
              {PANELS.map(([key, label]) => (
                <span key={key} className="row g8">
                  <Toggle
                    label={label}
                    checked={!!settings.general[key]}
                    onChange={(on) =>
                      patch((s) => {
                        s.general[key] = on
                      })
                    }
                  />
                  <span className="small">{label}</span>
                </span>
              ))}
            </div>

            <span className="k">Sounds</span>
            <span className="row g8">
              <Toggle
                label="Chat sounds"
                checked={
                  !!(
                    settings.sounds.agentEnabled ||
                    settings.sounds.permissionsEnabled ||
                    settings.sounds.errorsEnabled
                  )
                }
                onChange={(on) =>
                  patch((s) => {
                    s.sounds.agentEnabled = on
                    s.sounds.permissionsEnabled = on
                    s.sounds.errorsEnabled = on
                  })
                }
              />
              <span className="small">Agent, permission and error sounds</span>
            </span>
          </>
        ) : (
          <>
            <span className="k">More</span>
            <span className="small muted">
              Open the chat once in this browser (⌘J) — then its font size, panels and sounds appear here.
            </span>
          </>
        )}
      </div>
      <div className="row between wrap g12" style={{ marginTop: 14 }}>
        <span className="small muted">Changes reload the chat. What you change inside the chat itself is kept.</span>
        <Button
          size="sm"
          onClick={() =>
            change(() => {
              setChatTheme(DEFAULT_CHAT_THEME)
              setFollowsZyncTheme(true, shell.theme)
              applyChatDefaults(shell.theme)
              toast('Chat back to zync defaults · Matrix, matching zync')
            })
          }
        >
          Reset to zync defaults
        </Button>
      </div>
    </Card>
  )
}
