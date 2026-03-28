import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { useLayoutEffect, useMemo, useRef } from 'react'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import '@/styles/milkdown.css'

interface MarkdownContentProps {
  children: string
  raw?: boolean
  className?: string
}

export function MarkdownContent({ children, className = '' }: MarkdownContentProps) {
  const content = useMemo(() => {
    if (!children) return ''
    return children
  }, [children])

  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const contentRef = useRef(content)

  // Create / destroy Crepe editor in readonly mode
  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root || !content) return

    contentRef.current = content

    const crepe = new Crepe({
      root,
      defaultValue: content,
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.Placeholder]: false,
        [CrepeFeature.ImageBlock]: false,
        [CrepeFeature.Cursor]: false,
      },
    })

    crepe.setReadonly(true)

    crepe.create().then(() => {
      crepeRef.current = crepe
    })

    return () => {
      crepeRef.current = null
      crepe.destroy()
    }
  }, [content])

  if (!content) return null

  return <div ref={containerRef} className={`milkdown-editor-wrapper milkdown-editor-readonly ${className}`} />
}
