import matter from 'gray-matter'

/**
 * Parse YAML frontmatter from a raw markdown string.
 * If there is no frontmatter, metadata will be an empty object
 * and content will be the original string.
 */
export function parseFrontmatter(raw: string): { metadata: Record<string, any>; content: string } {
  const { data, content } = matter(raw)
  return { metadata: data, content: content.trimStart() }
}

/**
 * Serialize metadata + content back into a frontmatter string.
 * If metadata is empty (no keys), just return the content as-is.
 */
export function serializeFrontmatter(metadata: Record<string, any>, content: string): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return content
  }
  return matter.stringify(content, metadata)
}
