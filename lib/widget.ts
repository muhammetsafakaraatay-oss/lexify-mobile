import type { SavedWord } from './data'

export interface WidgetPreviewPayload {
  word: string
  translation?: string
  ipa?: string
  cefr?: string
  example?: string
}

export function buildWidgetPreview(words: SavedWord[]): WidgetPreviewPayload | null {
  const candidate = [...words]
    .sort((a, b) => String(a.due_at || '').localeCompare(String(b.due_at || '')))[0]
  if (!candidate) return null
  return {
    word: candidate.word,
    translation: candidate.translation,
    ipa: candidate.ipa,
    cefr: candidate.cefr_level || candidate.cefr,
    example: candidate.context_sentence || candidate.context,
  }
}
