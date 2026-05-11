import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Dimensions, ScrollView, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  SavedWord, listDueWords, listNewWords, listSavedWords,
  gradeWord, getDueCount, srsStateOf,
} from '../../lib/data'
import { Grade, previewGradeLabel } from '../../lib/srs'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { speak } from '../../lib/speech'
import { Ionicons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')
const CARD_W = Math.min(width - 40, 400)
const CARD_H = Math.min(height * 0.44, 320)

interface ResultRecord { wordId: string; wordText: string; grade: Grade }

const GRADES: { grade: Grade; label: string; color: string; bg: string }[] = [
  { grade: 'again', label: 'Tekrar', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  { grade: 'hard',  label: 'Zor',    color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  { grade: 'good',  label: 'İyi',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  { grade: 'easy',  label: 'Kolay',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
]

function stageLabel(stage: SavedWord['stage']) {
  const map: Record<string, string> = {
    new: 'YENİ', learning: 'ÖĞRENİLİYOR', review: 'TEKRAR', mastered: 'ÖĞRENİLDİ', leech: 'ZOR KELİME',
  }
  return map[stage] ?? stage.toUpperCase()
}

function stageColor(stage: SavedWord['stage']) {
  const map: Record<string, string> = {
    new: '#60a5fa', learning: '#facc15', review: '#4ade80', mastered: '#e879f9', leech: '#f87171',
  }
  return map[stage] ?? colors.textMuted
}

export default function FlashcardsScreen() {
  const [queue, setQueue] = useState<SavedWord[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [results, setResults] = useState<ResultRecord[]>([])
  const [streak, setStreak] = useState(0)
  const [counts, setCounts] = useState({ due: 0, newWords: 0, learning: 0 })
  const [mode, setMode] = useState<'due' | 'all'>('due')

  const flipAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const gradeRowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => { loadQueue('due') }, [])

  const loadQueue = useCallback(async (loadMode: 'due' | 'all' = 'due') => {
    setLoading(true)
    setFinished(false)
    setResults([])
    setStreak(0)
    setCurrent(0)
    setFlipped(false)
    setMode(loadMode)
    flipAnim.setValue(0)
    gradeRowAnim.setValue(0)

    let merged: SavedWord[] = []

    if (loadMode === 'all') {
      const all = await listSavedWords()
      // Shuffle so it's not always the same order
      merged = [...all].sort(() => Math.random() - 0.5).slice(0, 50)
    } else {
      const [dueCount, due, newer] = await Promise.all([
        getDueCount(), listDueWords(20), listNewWords(5),
      ])
      setCounts(dueCount)
      const seen = new Set<string>()
      for (const w of due) { if (!seen.has(w.id)) { merged.push(w); seen.add(w.id) } }
      for (const w of newer) {
        if (merged.length >= 20) break
        if (!seen.has(w.id)) { merged.push(w); seen.add(w.id) }
      }
    }

    setQueue(merged)
    setLoading(false)
    if (merged.length === 0) setFinished(true)
  }, [flipAnim, gradeRowAnim])

  function flipCard() {
    if (flipped) return
    Animated.spring(flipAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 40 }).start(() => {
      Animated.spring(gradeRowAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 60 }).start()
    })
    setFlipped(true)
    const w = queue[current]
    if (w?.word) speak(w.word)
  }

  async function handleGrade(grade: Grade) {
    const word = queue[current]
    if (!word) return

    setResults(prev => [...prev, { wordId: word.id, wordText: word.word, grade }])
    setStreak(prev => grade === 'again' ? 0 : prev + 1)
    gradeWord(word, grade).catch(e => console.warn('[flashcards] gradeWord failed:', e))

    // Slide out + reset
    Animated.timing(slideAnim, { toValue: grade === 'again' ? -20 : 20, duration: 120, useNativeDriver: true }).start(() => {
      flipAnim.setValue(0)
      gradeRowAnim.setValue(0)
      slideAnim.setValue(0)
      setFlipped(false)
      if (current + 1 >= queue.length) setFinished(true)
      else setCurrent(c => c + 1)
    })
  }

  const word = queue[current]

  const previews = useMemo(() => {
    if (!word) return {} as Record<Grade, string>
    const state = srsStateOf(word)
    const now = new Date()
    return GRADES.reduce((acc, btn) => {
      acc[btn.grade] = previewGradeLabel(state, btn.grade, now)
      return acc
    }, {} as Record<Grade, string>)
  }, [word])

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [1, 1, 0, 0] })
  const backOpacity  = flipAnim.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [0, 0, 1, 1] })
  const gradeOpacity = gradeRowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
  const gradeTranslate = gradeRowAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.loadingText}>Kartlar yükleniyor...</Text>
    </View>
  )

  // ── Finished ─────────────────────────────────────────────────────────────
  if (finished) {
    const total = results.length
    const known = results.filter(r => r.grade !== 'again').length
    const accuracy = total > 0 ? Math.round((known / total) * 100) : 0
    const hardestSeen = new Set<string>()
    const hardest = results
      .filter(r => r.grade === 'again' || r.grade === 'hard')
      .filter(r => { if (hardestSeen.has(r.wordId)) return false; hardestSeen.add(r.wordId); return true })
      .slice(0, 3).map(r => r.wordText)

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.finishWrap}>
          <Text style={styles.finishEmoji}>{total === 0 ? '✨' : accuracy >= 80 ? '🏆' : '🎉'}</Text>
          <Text style={styles.finishTitle}>
            {total === 0 ? 'Bugün tamamlandı!' : 'Oturum bitti!'}
          </Text>

          {total > 0 && (
            <View style={styles.finishStatsRow}>
              <View style={styles.finishStat}>
                <Text style={[styles.finishStatVal, { color: colors.accent }]}>{total}</Text>
                <Text style={styles.finishStatLabel}>kart</Text>
              </View>
              <View style={styles.finishStatDivider} />
              <View style={styles.finishStat}>
                <Text style={[styles.finishStatVal, { color: '#4ade80' }]}>{accuracy}%</Text>
                <Text style={styles.finishStatLabel}>doğruluk</Text>
              </View>
              <View style={styles.finishStatDivider} />
              <View style={styles.finishStat}>
                <Text style={[styles.finishStatVal, { color: '#fb923c' }]}>{streak}</Text>
                <Text style={styles.finishStatLabel}>seri</Text>
              </View>
            </View>
          )}

          {total === 0 && (
            <Text style={styles.finishEmpty}>Şu an gözden geçirilecek kelime yok.{'\n'}Yeni kelimeler kaydet veya yarın gel.</Text>
          )}

          <TouchableOpacity style={styles.allWordsBtn} onPress={() => loadQueue('all')}>
            <Ionicons name="layers-outline" size={18} color={colors.accent} />
            <Text style={styles.allWordsBtnText}>Tüm Kelimeleri Çalış</Text>
          </TouchableOpacity>

          {hardest.length > 0 && (
            <View style={styles.hardestBox}>
              <Text style={styles.hardestTitle}>En çok zorlandıkların</Text>
              {hardest.map((w, i) => (
                <View key={`${w}-${i}`} style={styles.hardestRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#fb923c" />
                  <Text style={styles.hardestItem}>{w}</Text>
                </View>
              ))}
            </View>
          )}

          {mode === 'due' && (
            <Text style={styles.tomorrowHint}>
              SM-2 algoritması tekrar aralıklarını güncelledi
            </Text>
          )}

          <TouchableOpacity style={styles.restartBtn} onPress={() => loadQueue(mode)}>
            <Ionicons name="refresh-outline" size={18} color={colors.bg} />
            <Text style={styles.restartBtnText}>Tekrar Başlat</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (!word) return null

  const progress = (current) / queue.length
  const isLeech = word.stage === 'leech'

  // ── Main card ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* Progress */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.progressText}>{current + 1} / {queue.length}</Text>
          {streak > 1 && (
            <View style={styles.streakPill}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakNum}>{streak}</Text>
            </View>
          )}
          {mode === 'all' && (
            <View style={styles.modePill}>
              <Ionicons name="layers-outline" size={11} color={colors.accent} />
              <Text style={styles.modeText}>SERBEST</Text>
            </View>
          )}
        </View>
        <View style={[styles.stagePill, { borderColor: stageColor(word.stage) }]}>
          <Text style={[styles.stageText, { color: stageColor(word.stage) }]}>{stageLabel(word.stage)}</Text>
        </View>
      </View>

      {/* Leech warning */}
      {isLeech && (
        <View style={styles.leechBanner}>
          <Ionicons name="warning-outline" size={14} color="#fca5a5" />
          <Text style={styles.leechText}>Bu kelime sana çok zor geliyor — örnekle birlikte ezberlemeyi dene.</Text>
        </View>
      )}

      {/* Card area */}
      <View style={styles.cardArea}>
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          <Pressable onPress={flipCard} style={styles.cardWrapper}>

            {/* Front */}
            <Animated.View style={[
              styles.card, styles.cardFront,
              { opacity: frontOpacity, transform: [{ rotateY: frontRotate }] }
            ]}>
              <View style={styles.cardTopRow}>
                {word.cefr ? (
                  <View style={[styles.cefrBadge, { borderColor: cefrColors[word.cefr] }]}>
                    <Text style={[styles.cefrText, { color: cefrColors[word.cefr] }]}>{word.cefr}</Text>
                  </View>
                ) : <View />}
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); speak(word.word) }}
                  style={styles.speakBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="volume-medium-outline" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.cardWord}>{word.word}</Text>
              {word.ipa ? <Text style={styles.ipa}>/{word.ipa}/</Text> : null}

              {word.lapses > 0 && (
                <View style={styles.lapseBadge}>
                  <Text style={styles.lapseText}>{word.lapses}× yanlış</Text>
                </View>
              )}

              <View style={styles.flipHint}>
                <Ionicons name="sync-outline" size={14} color={colors.textMuted} />
                <Text style={styles.flipHintText}>Cevabı görmek için dokun</Text>
              </View>
            </Animated.View>

            {/* Back */}
            <Animated.View style={[
              styles.card, styles.cardBack,
              { opacity: backOpacity, transform: [{ rotateY: backRotate }] }
            ]}>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); speak(word.word) }}
                style={styles.speakBtnBack}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="volume-medium-outline" size={18} color={colors.accent} />
                <Text style={styles.speakWordBack}>{word.word}</Text>
              </TouchableOpacity>

              <Text style={styles.cardTranslation}>{word.translation || '—'}</Text>

              {word.context ? (
                <View style={styles.contextBox}>
                  <Text style={styles.cardContext} numberOfLines={3}>{word.context}</Text>
                </View>
              ) : null}
            </Animated.View>

          </Pressable>
        </Animated.View>

        {/* Flip hint when not flipped */}
        {!flipped && (
          <Text style={styles.tapReminder}>Karta dokun → cevabı gör</Text>
        )}
      </View>

      {/* Grade buttons — only after flip */}
      <Animated.View style={[
        styles.gradeArea,
        { opacity: gradeOpacity, transform: [{ translateY: gradeTranslate }] }
      ]}
        pointerEvents={flipped ? 'auto' : 'none'}
      >
        <Text style={styles.gradeLabel}>Kendini nasıl değerlendiriyorsun?</Text>
        <View style={styles.gradeRow}>
          {GRADES.map(btn => (
            <TouchableOpacity
              key={btn.grade}
              style={[styles.gradeBtn, { backgroundColor: btn.bg, borderColor: btn.color }]}
              onPress={() => handleGrade(btn.grade)}
              activeOpacity={0.75}
            >
              <Text style={[styles.gradeBtnLabel, { color: btn.color }]}>{btn.label}</Text>
              <Text style={styles.gradeBtnPreview}>{previews[btn.grade]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 16 },
  loadingText: { color: colors.textMuted, fontSize: 14 },

  progressBg: { height: 3, backgroundColor: '#1a1a1a' },
  progressFill: { height: '100%', backgroundColor: colors.accent },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(251,146,60,0.12)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  streakFire: { fontSize: 14 },
  streakNum: { color: '#fb923c', fontWeight: '800', fontSize: 14 },
  stagePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stageText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },

  leechBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: 'rgba(248,113,113,0.07)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)',
    borderRadius: 10, padding: 10,
  },
  leechText: { flex: 1, color: '#fca5a5', fontSize: 12, lineHeight: 18 },

  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  cardWrapper: { width: CARD_W, height: CARD_H },

  card: {
    width: '100%', height: '100%', borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    padding: 28, position: 'absolute', backfaceVisibility: 'hidden',
  },
  cardFront: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1, borderColor: '#222',
  },
  cardBack: {
    backgroundColor: '#0d0d0d',
    borderWidth: 1.5, borderColor: 'rgba(250,204,21,0.3)',
  },

  cardTopRow: { position: 'absolute', top: 18, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  cefrText: { fontSize: 11, fontWeight: '800' },
  speakBtn: { padding: 6 },

  cardWord: { fontSize: 40, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -0.5 },
  ipa: { color: colors.textMuted, fontSize: 15, fontFamily: 'Courier', marginTop: 6, textAlign: 'center' },
  lapseBadge: { marginTop: 10, backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  lapseText: { color: '#f87171', fontSize: 11, fontWeight: '700' },
  flipHint: { position: 'absolute', bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 5 },
  flipHintText: { color: colors.textMuted, fontSize: 12 },

  speakBtnBack: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12, opacity: 0.7 },
  speakWordBack: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  cardTranslation: { fontSize: 34, fontWeight: '800', color: colors.accent, textAlign: 'center', marginBottom: 12 },
  contextBox: { backgroundColor: '#141414', borderRadius: 10, padding: 12, width: '100%' },
  cardContext: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  tapReminder: { color: colors.textMuted, fontSize: 13, marginTop: 16, opacity: 0.5 },

  gradeArea: { paddingHorizontal: 16, paddingBottom: 20 },
  gradeLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center', marginBottom: 10 },
  gradeRow: { flexDirection: 'row', gap: 8 },
  gradeBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center', gap: 4,
  },
  gradeBtnLabel: { fontSize: 14, fontWeight: '800' },
  gradeBtnPreview: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  // Finish screen
  finishWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  finishEmoji: { fontSize: 64, marginBottom: 16 },
  finishTitle: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  finishStatsRow: { flexDirection: 'row', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20, marginBottom: 20, gap: 0, width: '100%' },
  finishStat: { flex: 1, alignItems: 'center' },
  finishStatVal: { fontSize: 28, fontWeight: '800' },
  finishStatLabel: { fontSize: 11, color: colors.textMuted, marginTop: 3, fontWeight: '600' },
  finishStatDivider: { width: 1, backgroundColor: colors.border },
  finishEmpty: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  hardestBox: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 20, alignSelf: 'stretch' },
  hardestTitle: { color: colors.text, fontWeight: '700', marginBottom: 10, fontSize: 13, letterSpacing: 0.3 },
  hardestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  hardestItem: { color: colors.textDim, fontSize: 14 },
  tomorrowHint: { color: colors.textMuted, fontSize: 12, marginBottom: 24, textAlign: 'center' },
  restartBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 15 },
  restartBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },

  allWordsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.accent, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 13, marginBottom: 20,
  },
  allWordsBtnText: { color: colors.accent, fontWeight: '700', fontSize: 15 },

  modePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(250,204,21,0.1)', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  modeText: { color: colors.accent, fontWeight: '800', fontSize: 10, letterSpacing: 0.6 },
})
