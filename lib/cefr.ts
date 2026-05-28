import { colors } from './theme'

export const cefrColors: Record<string, string> = {
  A1: colors.cefr.A1,
  A2: colors.cefr.A2,
  B1: colors.cefr.B1,
  B2: colors.cefr.B2,
  C1: colors.cefr.C1,
  C2: colors.cefr.C2,
}

export const cefrLevels = ['Tümü', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export const cefrLabels: Record<string, { tr: string; en: string; desc: string }> = {
  A1: {
    tr: 'Başlangıç',
    en: 'Beginner',
    desc: 'Temel günlük ifadeler ve çok basit cümleler.',
  },
  A2: {
    tr: 'Temel',
    en: 'Elementary',
    desc: 'Sık kullanılan ifadeler, alışveriş ve seyahat gibi rutinler.',
  },
  B1: {
    tr: 'Orta Öncesi',
    en: 'Intermediate',
    desc: 'Tanıdık konularda açık ifadeler, seyahat, iş ve eğitim.',
  },
  B2: {
    tr: 'Üst Orta',
    en: 'Upper-Intermediate',
    desc: 'Karmaşık metinlerin ana fikirlerini anlama, akıcı iletişim.',
  },
  C1: {
    tr: 'İleri',
    en: 'Advanced',
    desc: 'Uzun ve zor metinleri anlama, kendiliğinden akıcı ifade.',
  },
  C2: {
    tr: 'Ustalık',
    en: 'Proficiency',
    desc: 'Okuduğunu ve duyduğunu kolaylıkla anlama, sezgisel ifade.',
  },
}
