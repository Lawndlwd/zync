import matter from 'gray-matter'

/**
 * Parse a markdown file's frontmatter. Always pass options: without them gray-matter caches every
 * input string forever (a leak for files edited all day) and hands back the same mutable object.
 */
export const parseFrontmatter = (source: string) => matter(source, {})

/**
 * A markdown file from its frontmatter and body. The body is written after a blank line; an empty
 * body leaves just the frontmatter.
 */
export const stringifyFrontmatter = (data: Record<string, unknown>, body: string) =>
  matter.stringify(body ? `\n${body}\n` : '', data)
