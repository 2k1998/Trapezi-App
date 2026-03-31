'use client'

type Props = {
  slug: string
  languages: string[]
  lang: string
  onLangChange: (lang: string) => void
}

export function LanguageSwitcher({
  slug,
  languages,
  lang,
  onLangChange,
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
              ? 'bg-accent-400 text-white'
              : 'bg-brand-100 text-brand-600 hover:bg-brand-200'
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
