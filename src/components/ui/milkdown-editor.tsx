import { useRef, useLayoutEffect, useEffect } from 'react'
import { Crepe, type CrepeConfig } from '@milkdown/crepe'
import { CrepeFeature } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import '@/styles/milkdown.css'
import { cn } from '@/lib/utils'

const TRAILING_LINES = 5
const TRAILING_NEWLINES = '\n'.repeat(TRAILING_LINES)

/** Ensure content has trailing blank lines so users can click below and type */
function withTrailingLines(content: string): string {
  return content.trimEnd() + TRAILING_NEWLINES
}

interface MilkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  /** Use 'borderless' to remove the card-like wrapper (useful inside panels) */
  variant?: 'default' | 'borderless'
}

export function MilkdownEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
  className,
  minHeight = '400px',
  variant = 'default',
}: MilkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const onChangeRef = useRef(onChange)
  const suppressRef = useRef(false)
  const editorContentRef = useRef(value)

  // Keep onChange ref current to avoid stale closures
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Create / destroy the Crepe editor
  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return

    const config: CrepeConfig = {
      root,
      defaultValue: withTrailingLines(value),
      features: {
        [CrepeFeature.Placeholder]: true,
        [CrepeFeature.BlockEdit]: false,
      },
      featureConfigs: {
        [CrepeFeature.Placeholder]: {
          text: placeholder,
        },
      },
    }

    const crepe = new Crepe(config)

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, _prevMarkdown) => {
        if (suppressRef.current) return
        editorContentRef.current = markdown
        onChangeRef.current(markdown)
      })
    })

    crepe.create().then(() => {
      crepeRef.current = crepe
    })

    return () => {
      crepeRef.current = null
      crepe.destroy()
    }
    // We intentionally only depend on value identity for recreation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle external value changes: destroy + recreate when value diverges
  useEffect(() => {
    // Skip the initial render – the layout effect handles that
    if (editorContentRef.current === value) return

    const root = containerRef.current
    if (!root) return

    // Value changed externally – recreate editor
    const oldCrepe = crepeRef.current
    crepeRef.current = null

    const rebuild = async () => {
      if (oldCrepe) {
        suppressRef.current = true
        await oldCrepe.destroy()
        suppressRef.current = false
      }

      // Clear any leftover DOM from the previous editor
      root.innerHTML = ''

      const config: CrepeConfig = {
        root,
        defaultValue: withTrailingLines(value),
        features: {
          [CrepeFeature.Placeholder]: true,
        },
        featureConfigs: {
          [CrepeFeature.Placeholder]: {
            text: placeholder,
          },
        },
      }

      const crepe = new Crepe(config)

      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, _prevMarkdown) => {
          if (suppressRef.current) return
          editorContentRef.current = markdown
          onChangeRef.current(markdown)
        })
      })

      editorContentRef.current = value
      await crepe.create()
      crepeRef.current = crepe
    }

    rebuild()
  }, [value, placeholder])

  return (
    <div
      ref={containerRef}
      className={cn(
        'milkdown-editor-wrapper overflow-hidden',
        variant === 'default' && 'rounded-lg border border-white/[0.1] bg-white/[0.04]',
        className,
      )}
      style={{ minHeight }}
    />
  )
}
