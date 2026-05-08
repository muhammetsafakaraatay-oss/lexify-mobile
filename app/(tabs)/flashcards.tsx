import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Dimensions, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  SavedWord,
  listDueWords,
  listNewWords,
  gradeWord,
  getDueCount,
  srsStateOf,
} from '../../lib/data'
import { Grade, previewGradeLabel } from '../../lib/srs'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import * as Speech from 'expo-speech'

const { width } = Dimensions.get('window')

interface ResultRecord {
  wordId: string
  wordText: string
  grade: Grade
}

const GRADE_BUTTONS: { grade: Grade; label: string; color: string; icon: string }[] = [
  { grade: 'again', label: 'Tekrar',  color: '#f87171', icon: '↺' },
  { grade: 'hard',  label: 'Zor',     color: '#fb923c', icon: '↘' },
  { grade: 'good',  label: 'İyi',     color: '#4ade80', icon: '✓' },
  { grade: 'easy',  label: 'Kolay',   color: '#60a5fa', icon: '⇡' },
]

export default function FlashcardsScreen() {
  const [queue, setQueue] = useState<SavedWord[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [results, setResults] = useState<ResultRecord[]>([])
  const [streak, setStreak] = useState(0)
  const [counts, setCounts] = useState<{ due: number; newWords: number; learning: number }>({
    due: 0, newWords: 0, learning: 0,
  })
  const flipAnim = useRef(new Animated.Value(0)).current

  useEffect(() => { loadQueue() }, [])

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setFinished(false)
    setResults([])
    setStreak(0)
    setCurrent(0)
    setFlipped(false)
    flipAnim.setValue(0)

    const [dueCount, due, newer] = await Promise.all([
      getDueCount(),
      listDueWords(20),
      listNewWords(5),
    ])
    setCounts(dueCount)

    // Önce due olanlar (review/learning), sonra yeni kelimelerle 20'ye tamamla
    const merged: SavedWord[] = []
    const seen = new Set<string>()
    for (const w of due) {
      if (!seen.has(w.id)) { merged.push(w); seen.add(w.id) }
    }
    for (const w of newer) {
      if (merged.length >= 20) break
      if (!seen.has(w.id)) { merged.push(w); seen.add(w.id) }
    }

    setQueue(merged)
    setLoading(false)
    if (merged.length === 0) setFinished(true)
  }, [flipAnim])

  function flipCard() {
    const toValue = flipped ? 0 : 1
    Animated.spring(flipAnim, { toValue, useNativeDriver: true, friction: 8, tension: 10 }).start()
    setFlipped(!flipped)
  }

  async function handleGrade(grade: Grade) {
    const word = queue[current]
    if (!word) return

    setResults((prev) => [...prev, { wordId: word.id, wordText: word.word, grade }])
    setStreak((prev) => grade === 'again' ? 0 : prev + 1)

    // Optimistic — DB güncellemesi paralel çalışsın, UI bloklanmasın
    gradeWord(word, grade).catch((e) => console.warn('[flashcards] gradeWord failed:', e))

    // Animasyonu sıfırla
    Animated.timing(flipAnim, { toValue: 0, duration: 0, useNativeDriver: true }).start()
    setFlipped(false)

    if (current + 1 >= queue.length) {
      setFinished(true)
    } else {
      setCurrent((c) => c + 1)
    }
  }

  const word = queue[current]

  // Buton önizleme etiketleri (her butonun altında "1g", "4g" gibi)
  const previews = useMemo(() => {
    if (!word) return {} as Record<Grade, string>
    const state = srsStateOf(word)
    const now = new Date()
    const out: Record<Grade, string> = { again: '', hard: '', good: '', easy: '' }
    for (const btn of GRADE_BUTTONS) {
      out[btn.grade] = previewGradeLabel(state, btn.grade, now)
    }
    return out
  }, [word])

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [1, 1, 0, 0] })
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [0, 0, 1, 1] })

  // ── UI states ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (finished) {
    const total = results.length
    const known = results.filter((r) => r.grade !== 'again').length
    const accuracy = total > 0 ? Math.round((known / total) * 100) : 0
    const hardestSeen = new Set<string>()
    const hardest = results
      .filter((r) => r.grade === 'again' || r.grade === 'hard')
      .filter((r) => {
        if (hardestSeen.has(r.wordId)) return false
        hardestSeen.add(r.wordId)
        return true
      })
      .slice(0, 3)
      .map((r) => r.wordText)

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.finishWrap}>
          <Text style={styles.finishEmoji}>{total === 0 ? '✨' : '🎉'}</Text>
          <Text style={styles.finishTitle}>
            {total === 0 ? 'Bugün için hazırsın' : 'Tebrikler!'}
          </Text>
          <Text style={styles.finishSub}>
            {total === 0
              ? 'Şu an gözden geçirilecek kelime yok. Yeni kelimeler kaydet veya yarın gel.'
              : `${total} kart · %${accuracy} doğruluk`}
          </Text>

          {streak > 2 && total > 0 && (
            <Text style={styles.streakText}>🔥 {streak} seri</Text>
          )}

          {hardest.length > 0 && (
            <View style={styles.hardestBox}>
              <Text style={styles.hardestTitle}>En çok zorlandıkların</Text>
              {hardest.map((w, i) => (
                <Text key={`${w}-${i}`} style={styles.hardestItem}>• {w}</Text>
              ))}
            </View>
          )}

          <Text style={styles.tomorrowHint}>
            Yarın {counts.due + counts.newWords > 0 ? 'aynı tempoda devam' : 'yeni kelimelerle'} • SM-2 algoritması ile aralıklar açıldı
          </Text>

          <TouchableOpacity style={styles.restartBtn} onPress={loadQueue}>
            <Text style={styles.restartBtnText}>Tekrar Yükle</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (!word) return null

  const isLeech = word.stage === 'leech'

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progress}>{current + 1} / {queue.length}</Text>
        <View style={styles.headerChips}>
          {counts.due > 0 && (
            <View style={[styles.chip, { borderColor: colors.accent }]}>
              <Text style={[styles.chipText, { color: colors.accent }]}>{counts.due} review</Text>
            </View>
          )}
          {counts.newWords > 0 && (
            <View style={[styles.chip, { borderColor: '#60a5fa' }]}>
              <Text style={[styles.chipText, { color: '#60a5fa' }]}>{counts.newWords} yeni</Text>
            </View>
          )}
          {streak > 1 && (
            <Text style={styles.streakBadge}>🔥 {streak}</Text>
          )}
        </View>
      </View>

      {isLeech && (
        <View style={styles.leechBanner}>
          <Text style={styles.leechText}>
            ⚠️ Bu kelime sana çok zor geliyor. Bağlamı yeniden oku ve örnekle birlikte ezberlemeyi dene.
          </Text>
        </View>
      )}

      <View style={styles.cardArea}>
        <TouchableOpacity onPress={flipCard} activeOpacity={0.95} style={styles.cardWrapper}>
          <Animated.View style={[
            styles.card, styles.cardFront,
            { opacity: frontOpacity, transform: [{ rotateY: frontRotate }] },
          ]}>
            <Text style={styles.cardWord}>{word.word}</Text>
            {word.cefr && (
              <View style={[styles.cefrBadge, { borderColor: cefrColors[word.cefr] }]}>
                <Text style={[styles.cefrText, { color: cefrColors[word.cefr] }]}>{word.cefr}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => Speech.speak(word.word, { language: 'en-US', rate: 0.8 })}
              style={styles.speakBtn}
            >
              <Text style={styles.speakText}>🔊</Text>
            </TouchableOpacity>
            {word.ipa ? <Text style={styles.ipa}>/{word.ipa}/</Text> : null}
            <Text style={styles.tapHint}>Çevirmek için dokun</Text>
          </Animated.View>

          <Animated.View style={[
            styles.card, styles.cardBack,
            { opacity: backOpacity, transform: [{ rotateY: backRotate }] },
          ]}>
            <Text style={styles.cardTranslation}>{word.translation || '—'}</Text>
            {word.context ? (
              <Text style={styles.cardContext} numberOfLines={4}>{word.context}</Text>
            ) : null}
          </Animated.View>
        </TouchableOpacity>

        <Text style={styles.stageLabel}>
          {stageLabel(word.stage)}
          {word.lapses > 0 ? ` · ${word.lapses}× yanlış` : ''}
        </Text>
      </View>

      <View style={styles.gradeRow}>
        {GRADE_BUTTONS.map((btn) => (
          <TouchableOpacity
            key={btn.grade}
            style={[styles.gradeBtn, { borderColor: btn.color }]}
            onPress={() => handleGrade(btn.grade)}
            activeOpacity={0.7}
          >
            <Text style={[styles.gradeIcon, { color: btn.color }]}>{btn.icon}</Text>
            <Text style={[styles.gradeLabel, { color: btn.color }]}>{btn.label}</Text>
            <Text style={styles.gradePreview}>{previews[btn.grade]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

function stageLabel(stage: SavedWord['stage']): string {
  switch (stage) {
    case 'new':       return '🆕 Yeni'
    case 'learning':  return '📘 Öğreniliyor'
    case 'review':    return '🔁 Review'
    case 'mastered':  return '✅ Öğrenildi'
    case 'leech':     return '⚠️ Zor kelime'
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  progress: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  headerChips: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '700' },
  streakBadge: { fontSize: 16, marginLeft: 4 },

  leechBanner: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 12, padding: 12,
  },
  leechText: { color: '#fca5a5', fontSize: 13, lineHeight: 19 },

  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  cardWrapper: { width: width - 40, height: 300 },
  card: {
    width: '100%', height: '100%', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', padding: 28,
    position: 'absolute', backfaceVisibility: 'hidden',
  },
  cardFront: { backgroundColor: '#111', borderWidth: 1, borderColor: colors.border },
  cardBack: { backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: colors.accent },
  cardWord: { fontSize: 36, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 12 },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 14 },
  cefrText: { fontSize: 12, fontWeight: '700' },
  speakBtn: { marginBottom: 8 },
  speakText: { fontSize: 32 },
  ipa: { color: colors.textMuted, fontSize: 14, marginBottom: 12 },
  tapHint: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  cardTranslation: { fontSize: 30, fontWeight: '700', color: colors.accent, textAlign: 'center', marginBottom: 14 },
  cardContext: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  stageLabel: { color: colors.textMuted, fontSize: 12, marginTop: 14, fontWeight: '600' },

  gradeRow: {
    flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 24,
  },
  gradeBtn: {
    flex: 1, backgroundColor: '#0f0f0f', borderWidth: 1, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', gap: 4,
  },
  gradeIcon: { fontSize: 22, fontWeight: '700' },
  gradeLabel: { fontSize: 13, fontWeight: '800' },
  gradePreview: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  // Finish
  finishWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  finishEmoji: { fontSize: 64, marginBottom: 16 },
  finishTitle: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  finishSub: { color: colors.textMuted, fontSize: 16, marginBottom: 20, textAlign: 'center' },
  streakText: { color: colors.accent, fontSize: 22, marginBottom: 16, fontWeight: '700' },
  hardestBox: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 16, marginBottom: 16, alignSelf: 'stretch',
  },
  hardestTitle: { color: colors.text, fontWeight: '700', marginBottom: 8, fontSize: 14 },
  hardestItem: { color: colors.textDim, fontSize: 14, marginBottom: 4 },
  tomorrowHint: { color: colors.textMuted, fontSize: 13, marginBottom: 24, textAlign: 'center', lineHeight: 19 },
  restartBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  restartBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
})
