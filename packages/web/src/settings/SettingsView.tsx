import { useParams } from 'react-router'

import { ButtonLink } from '../components/ButtonLink'
import { Card } from '../components/Card'
import { Segmented } from '../components/Segmented'
import { ConfigFiles } from '../files/ConfigFiles'
import { wsUrl } from '../helpers/urls'
import { useShell } from '../shell/ShellContext'
import type { Theme } from '../types/shell'
import { ChatAppearance } from './ChatAppearance'
import { SecurityPanel } from './SecurityPanel'

export function SettingsView() {
  const { ws = '' } = useParams()
  const shell = useShell()
  return (
    <div className="page col g24">
      <div className="col g16">
        <span className="mono muted">{ws} / settings</span>
        <h1 className="display">Settings</h1>
        <p className="lede">
          How zync looks, and the <b>AI server</b> config every chat and job runs with.
        </p>
      </div>
      <Card title="Appearance" meta="This browser">
        <div className="row between wrap g12">
          <span className="small muted">Follow the system, or pick one.</span>
          <Segmented<Theme>
            label="Theme"
            value={shell.theme}
            onChange={shell.setTheme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </Card>
      <SecurityPanel />
      <ConfigFiles ws={ws} />
      <ChatAppearance />
      <Card title="AI server" meta="opencode.json · agents · commands · skills">
        <div className="row between wrap g12">
          <span className="small muted">
            The config every chat and job runs with, and the AI’s agents, commands and skills, live on the OpenCode
            page.
          </span>
          <ButtonLink size="sm" to={wsUrl(ws, 'opencode')}>
            Open OpenCode →
          </ButtonLink>
        </div>
      </Card>
    </div>
  )
}
