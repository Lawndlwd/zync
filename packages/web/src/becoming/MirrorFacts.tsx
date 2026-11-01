import { MarkdownSpans } from '../components/MarkdownSpans'
import { identityColor, identityName } from '../helpers/becoming'
import { capitalize } from '../helpers/format'
import type { IdentityWeek, MirrorFact } from '../types/becoming'

/** "What the week says": one plain sentence per identity, then the unclaimed time. */
export function MirrorFacts({
  ws,
  facts,
  identities,
}: {
  ws: string
  facts: MirrorFact[]
  identities: IdentityWeek[]
}) {
  if (facts.length === 0) return null
  return (
    <section aria-label="What the week says">
      <div className="card-h" style={{ borderColor: 'var(--ink)' }}>
        <span className="t">What the week says</span>
        <span className="m">Plain facts · no scores</span>
      </div>
      {facts.map((f, n) => {
        const index = identities.findIndex((i) => i.file === f.identity)
        const who = identities[index]
        return (
          // oxlint-disable-next-line react/no-array-index-key -- facts are a fixed list written once a week
          <div key={n} className="fact" style={n === facts.length - 1 ? { borderBottom: 0 } : undefined}>
            <span className="mono-s row g8">
              {who ? (
                <>
                  <i className="sw-id" style={{ background: identityColor(index) }} />
                  {capitalize(identityName(who.statement))}
                </>
              ) : (
                <>
                  <i className="sw-id unclaimed" style={{ border: '1px solid var(--line)' }} />
                  Unclaimed
                </>
              )}
            </span>
            <p>
              <MarkdownSpans ws={ws} text={f.text} />
            </p>
          </div>
        )
      })}
    </section>
  )
}
