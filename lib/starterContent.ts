import type { CefrLevel } from './prefs'

export const FIRST_SESSION_SAMPLE = {
  title: 'İlk Okuma — Lexify',
  text: `Learning a language takes time, but daily exposure makes a remarkable difference. When you read a short article, notice unfamiliar words, and review them later, your brain starts connecting meaning with real context. The process becomes natural over time, especially when you encounter words repeatedly across different sources.`,
}

export interface StarterArticle {
  id: string
  title: string
  url: string
  source: string
  cefr_level: string
  description: string
  image_url: string
}

/** API yanıt vermezse Keşfet için örnek içerik */
export const FALLBACK_ARTICLES: StarterArticle[] = [
  {
    id: 'fb-1',
    title: 'Why small habits beat motivation',
    url: 'https://www.bbc.com/future/article/20230109-why-motivation-isnt-enough',
    source: 'BBC Future',
    cefr_level: 'B1',
    description: 'Kısa okuma: alışkanlık ve süreklilik üzerine.',
    image_url: '',
  },
  {
    id: 'fb-2',
    title: 'The science of spaced repetition',
    url: 'https://fs.blog/spacing-effect/',
    source: 'Farnam Street',
    cefr_level: 'B2',
    description: 'Aralıklı tekrarın öğrenmeye etkisi.',
    image_url: '',
  },
  {
    id: 'fb-3',
    title: 'A2: My morning routine',
    url: 'https://learnenglish.britishcouncil.org/skills/reading/a2-reading',
    source: 'British Council',
    cefr_level: 'A2',
    description: 'Başlangıç seviye kısa metin.',
    image_url: '',
  },
]

const LEVEL_TIPS: Record<CefrLevel, { headline: string; tip: string; cefr: string }> = {
  A1: { headline: 'Kısa cümlelerle başla', tip: 'Günde 5 kelime + basit metin yeterli.', cefr: 'A1' },
  A2: { headline: 'Günlük rutin metinleri', tip: 'Tanıdık konularda oku, kelime yakala.', cefr: 'A2' },
  B1: { headline: 'Haber özeti oku', tip: 'BBC / British Council ile orta seviye pratik.', cefr: 'B1' },
  B2: { headline: 'Uzun makalelere geç', tip: 'Bağlamdan anlam çıkar, zor kelimeleri kaydet.', cefr: 'B2' },
  C1: { headline: 'Akademik kaynaklar', tip: 'CEFR C1 kelimelerine odaklan.', cefr: 'C1' },
  C2: { headline: 'İnce ayar modu', tip: 'Nadir kelimeler ve nuans için transcript kullan.', cefr: 'C2' },
}

export function getLevelGuide(level: CefrLevel) {
  return LEVEL_TIPS[level] ?? LEVEL_TIPS.B1
}

export function articlesForLevel(level: CefrLevel, all: StarterArticle[]): StarterArticle[] {
  const match = all.filter((a) => a.cefr_level === level)
  if (match.length >= 2) return match
  return all.slice(0, 4)
}
