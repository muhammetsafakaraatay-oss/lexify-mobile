/**
 * Ücretsiz / Pro plan sınırları — App Store abonelik modeli için MVP tanımı.
 * Pro entitlement aktifken tüm limitler kalkar.
 */

export const PRO_ENTITLEMENT_ID = 'pro'

export const FREE_LIMITS = {
  /** Toplam kayıtlı kelime üst sınırı */
  maxSavedWords: 30,
  /** Günlük yeni kelime kaydı (bugün eklenen) */
  maxSavesPerDay: 8,
  /** Tek flashcard oturumunda kart sayısı */
  maxFlashcardsPerSession: 12,
  /** Günlük tam quiz oturumu */
  maxQuizSessionsPerDay: 1,
  /** Günlük ters çeviri denemesi */
  maxReverseQuizAttemptsPerDay: 3,
} as const

export const PRO_FEATURES = [
  { icon: 'mic-outline' as const, title: 'Sesli pratik arsivi', desc: 'Kendi sesinle pratik yap, transcript ve koçluk notlarini sakla' },
  { icon: 'infinite-outline' as const, title: 'Sınırsız kelime kaydı', desc: 'Okurken, videoda ve OCR ile istediğin kadar kelime' },
  { icon: 'camera-outline' as const, title: 'Kamera OCR', desc: 'Kitap ve ekranlardan metin tara, kelimeye dokun' },
  { icon: 'play-circle-outline' as const, title: 'YouTube transcript', desc: 'Video izlerken transcript üzerinden öğren' },
  { icon: 'layers-outline' as const, title: 'Sınırsız çalışma', desc: 'Flashcard ve quiz oturumlarında limit yok' },
  { icon: 'cloud-outline' as const, title: 'Bulut senkron', desc: 'Hesabınla tüm cihazlarda kelimelerin güvende' },
] as const

export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'lexify_pro_monthly',
  yearly: 'lexify_pro_yearly',
} as const

export function canSaveWord(isPro: boolean, totalWords: number, todaySaves: number): boolean {
  if (isPro) return true
  if (totalWords >= FREE_LIMITS.maxSavedWords) return false
  if (todaySaves >= FREE_LIMITS.maxSavesPerDay) return false
  return true
}

export function flashcardSessionLimit(isPro: boolean, requested: number): number {
  if (isPro) return requested
  return Math.min(requested, FREE_LIMITS.maxFlashcardsPerSession)
}

export function isPremiumFeature(feature: 'camera' | 'video' | 'quiz' | 'flashcards_unlimited', isPro: boolean): boolean {
  if (isPro) return true
  if (feature === 'camera' || feature === 'video') return false
  if (feature === 'quiz' || feature === 'flashcards_unlimited') return false
  return true
}
