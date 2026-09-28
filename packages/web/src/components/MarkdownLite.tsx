import { mdBlocks } from '../helpers/markdownLite'
import { MarkdownSpans } from './MarkdownSpans'

/** A short generated page read as markdown (see helpers/markdownLite). Links to workspace files open them. */
export function MarkdownLite({ ws, source }: { ws: string; source: string }) {
  return (
    <div className="md-lite">
      {mdBlocks(source).map((b, i) => {
        const key = `${i}:${b.type}`
        if (b.type === 'h')
          return (
            <h3 key={key} className="flabel">
              <MarkdownSpans ws={ws} text={b.text} />
            </h3>
          )
        return (
          <p key={key} className={b.type === 'li' ? 'md-li' : undefined}>
            <MarkdownSpans ws={ws} text={b.text} />
          </p>
        )
      })}
    </div>
  )
}
