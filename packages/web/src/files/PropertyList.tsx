import { itemSummary } from './helpers'

/**
 * A list of objects in the frontmatter (a brief's to-dos, anything nested), shown to read: one
 * row per item, its title then its other fields. Edited in the page's source, where the shape stays intact.
 */
export function PropertyList({ items }: { items: unknown[] }) {
  return (
    <div className="prop-list">
      {items.map((item, i) => {
        const { title, details } = itemSummary(item)
        return (
          // oxlint-disable-next-line react/no-array-index-key -- items have no id; the list is read-only and re-rendered whole
          <div key={i} className="prop-item">
            <span className="small">{title}</span>
            {details.map(([k, v]) => (
              <span key={k} className="mono-s muted prop-detail">
                {k}:{' '}
                {/^https?:\/\//.test(v) ? (
                  <a className="link-inline" href={v} target="_blank" rel="noreferrer">
                    {v}
                  </a>
                ) : (
                  v
                )}
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
