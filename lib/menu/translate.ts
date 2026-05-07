import * as deepl from 'deepl-node'

export type TranslationResult = {
  el: string
  en: string
}

export type TranslationError = {
  code: 'TRANSLATION_FAILED'
  message: string
}

export async function translateMenuItem(text: string): Promise<TranslationResult> {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) {
    throw { code: 'TRANSLATION_FAILED', message: 'DEEPL_API_KEY is not configured' } as TranslationError
  }

  const translator = new deepl.Translator(apiKey)

  let el: string
  let en: string

  try {
    // First, detect language by translating to EN-GB
    const toEnResult = await translator.translateText(text, null, 'en-GB' as deepl.TargetLanguageCode)
    const detectedLang = toEnResult.detectedSourceLang?.toUpperCase()

    if (detectedLang === 'EL') {
      // Source is Greek → EN translation already done, also pass Greek through as-is
      en = toEnResult.text
      el = text
    } else {
      // Source is English or other → use EN as-is, translate to EL
      en = text
      const toElResult = await translator.translateText(text, null, 'el' as deepl.TargetLanguageCode)
      el = toElResult.text
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw { code: 'TRANSLATION_FAILED', message } as TranslationError
  }

  return { el, en }
}
