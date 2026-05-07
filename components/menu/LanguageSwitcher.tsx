'use client'

type Props = {
  slug: string
  languages: string[]
  lang: string
  onLangChange: (lang: string) => void
  accent: string
  headerFg: string
}

export function LanguageSwitcher({
  slug,
  languages,
  lang,
  onLangChange,
  accent,
  headerFg,
}: Props) {
  if (languages.length <= 1) return null

  return (
    <div className="flex flex-shrink-0 gap-1.5">
      {languages.map(code => (
        <button
          key={code}
          type="button"
          onClick={() => {
            onLangChange(code)
            try {
              localStorage.setItem(`lang_${slug}`, code)
            } catch {
              /* empty */
            }
          }}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            lang === code
              ? 'text-white'
              : 'bg-brand-100 hover:bg-brand-200'
          }`}
          style={
            lang === code
              ? { backgroundColor: accent, color: headerFg }
              : { color: '#3D3C37' }
          }
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
