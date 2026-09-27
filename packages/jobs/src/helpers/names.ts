/**
 * A name as a kebab-case id: accents stripped, lowercase, words joined by `-`, at most `max` chars.
 * `fallback` when nothing is left (a name without a single letter or digit).
 */
export function slugify(name: string, max = 32, fallback = 'x'): string {
  return (
    name
      .normalize('NFKD')
      .replaceAll(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/, '') || fallback
  )
}

/** A title as a portable file/folder name: no path separators or reserved characters. */
export function safeName(title: string): string {
  const name = title
    // oxlint-disable-next-line eslint/no-control-regex -- stripping control characters is the point
    .replaceAll(/[/\\:*?"<>|\u0000-\u001f]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 100)
    .trim()
  return name || 'Untitled'
}
