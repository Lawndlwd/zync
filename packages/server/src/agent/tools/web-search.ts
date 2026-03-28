export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIAssistant/1.0)',
    },
  })

  if (!response.ok) throw new Error(`Search failed: ${response.status}`)
  const html = await response.text()

  const results: SearchResult[] = []
  const resultPattern =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi

  let match: RegExpExecArray | null
  while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
    let href = match[1]
    const uddgMatch = href.match(/uddg=([^&]+)/)
    if (uddgMatch) href = decodeURIComponent(uddgMatch[1])

    results.push({
      title: match[2].replace(/<[^>]+>/g, '').trim(),
      url: href,
      snippet: match[3].replace(/<[^>]+>/g, '').trim(),
    })
  }

  return results
}
