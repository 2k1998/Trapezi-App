export function pickLocalized(
  obj: Record<string, string> | null | undefined,
  lang: string
): string {
  if (!obj || typeof obj !== 'object') return ''
  return obj[lang] ?? obj['en'] ?? Object.values(obj)[0] ?? ''
}
