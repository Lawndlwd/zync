import { createHighlighter, type Highlighter, type BundledLanguage, type BundledTheme } from 'shiki'

export const THEMES: { value: BundledTheme; label: string }[] = [
  { value: 'github-dark', label: 'GitHub Dark' },
  { value: 'github-dark-dimmed', label: 'GitHub Dimmed' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'one-dark-pro', label: 'One Dark Pro' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'tokyo-night', label: 'Tokyo Night' },
  { value: 'nord', label: 'Nord' },
  { value: 'catppuccin-mocha', label: 'Catppuccin' },
  { value: 'material-theme-ocean', label: 'Material Ocean' },
  { value: 'vitesse-dark', label: 'Vitesse Dark' },
  { value: 'ayu-dark', label: 'Ayu Dark' },
  { value: 'night-owl', label: 'Night Owl' },
  { value: 'poimandres', label: 'Poimandres' },
  { value: 'solarized-dark', label: 'Solarized Dark' },
]

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: THEMES.map((t) => t.value),
      langs: [
        'javascript', 'typescript', 'tsx', 'jsx', 'json', 'css', 'scss',
        'html', 'yaml', 'markdown', 'python', 'go', 'rust', 'bash', 'shell',
        'sql', 'graphql', 'dockerfile', 'toml', 'xml', 'ruby', 'java',
        'c', 'cpp', 'csharp', 'php', 'swift', 'kotlin',
      ],
    })
  }
  return highlighterPromise
}

const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript',
  tsx: 'tsx', jsx: 'jsx',
  json: 'json', jsonc: 'json',
  css: 'css', scss: 'scss', sass: 'scss',
  html: 'html', htm: 'html', svg: 'xml', xml: 'xml',
  yml: 'yaml', yaml: 'yaml',
  md: 'markdown', mdx: 'markdown',
  py: 'python',
  go: 'go',
  rs: 'rust',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  sql: 'sql',
  graphql: 'graphql', gql: 'graphql',
  dockerfile: 'dockerfile',
  toml: 'toml',
  rb: 'ruby',
  java: 'java',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin', kts: 'kotlin',
}

export function detectLang(filePath: string): string {
  const name = filePath.split('/').pop() || ''
  if (name === 'Dockerfile' || name.startsWith('Dockerfile.')) return 'dockerfile'
  if (name === '.gitignore' || name === '.env') return 'bash'
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return EXT_TO_LANG[ext] || 'text'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function highlightLines(
  lines: string[],
  filePath: string,
  theme: BundledTheme = 'github-dark'
): Promise<string[]> {
  const lang = detectLang(filePath)
  if (lang === 'text') return lines.map(escapeHtml)

  try {
    const highlighter = await getHighlighter()
    const code = lines.join('\n')
    const { tokens } = highlighter.codeToTokens(code, {
      lang: lang as BundledLanguage,
      theme,
    })

    return tokens.map((lineTokens, i) => {
      if (!lineTokens || lineTokens.length === 0) return escapeHtml(lines[i] || '')
      return lineTokens
        .map((token) => {
          const escaped = escapeHtml(token.content)
          if (token.color) {
            return `<span style="color:${token.color}">${escaped}</span>`
          }
          return escaped
        })
        .join('')
    })
  } catch {
    return lines.map(escapeHtml)
  }
}
