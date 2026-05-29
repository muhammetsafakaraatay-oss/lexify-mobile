/**
 * Learn mode — adaptive round-robin.
 * Round 1: 4-option multiple choice (English term shown, pick Turkish translation).
 * Round 2: typed answer (English shown, user types Turkish — Levenshtein-tolerant).
 * Round 3: classic flip self-grade.
 * Items only graduate when answered correctly in the current round's question type.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, TextInput, Pressable, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import { speak } from '../../../lib/speech'
import { bumpMastery, getSet, populateSet, type PopulatedSet } from '../../../lib/sets'
import {
  answerCorrect, answerWrong, currentItem, initRoundRobin, isComplete,
  progress, type RoundRobinState,
} from '../../../lib/roundRobin'
import type { SavedWord } from '../../../lib/data'

type Stage = 'mc' | 'typed' | 'reveal'

const adapter = { idOf: (w: SavedWord) => w.id }

function normalize(s: string): string {
  return (s || '').toLowerCase().trim()
    .replace(/[.,!?;:'"()\[\]]/g, '')
    .replace(/\s+/g, ' ')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  const m = a.length, n = b.length
  const dp: number[] = new Array(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

function isAcceptableTyped(answer: string, expected: string): 'ok' | 'close' | 'wrong' {
  const a = normalize(answer)
  const e = normalize(expected)
  if (!a || !e) return 'wrong'
  if (a === e) return 'ok'
  // Accept any comma-separated alternative.
  const alts = e.split(',').map((s) => s.trim()).filter(Boolean)
  if (alts.includes(a)) return 'ok'
  const dist = Math.min(...alts.map((alt) => levenshtein(a, alt)))
  if (dist <= 1) return 'close'
  if (dist === 2 && e.length >= 6) return 'close'
  return 'wrong'
}

function pickDistractors(pool: SavedWord[], correct: SavedWord, count: number): string[] {
  const candidates = pool
    .filter((w) => w.id !== correct.id && !!w.translation && w.translation !== correct.translation)
    .map((w) => w.translation as string)
  const unique = Array.from(new Set(candidates))
  // Shuffle
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[unique[i], unique[j]] = [unique[j], unique[i]]
  }
  return unique.slice(0, count)
}

function stageForRound(round: number): Stage {
  if (round === 1) return 'mc'
  if (round === 2) return 'typed'
  return 'reveal'
}

export default function LearnScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [set, setSet] = useState<PopulatedSet | null>(null)
  const [state, setState] = useState<RoundRobinState<SavedWord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'close' | 'wrong'; expected?: string } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const shake = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let alive = true
    if (!id) return
    ;(async () => {
      const raw = await getSet(id)
      const populated = await populateSet(raw)
      if (!alive) return
      setSet(populated)
      if (populated && populated.terms.length > 0) {
        // Only learn words that aren't fully mastered yet.
        const toLearn = populated.terms.filter((t) => (populated.mastery[t.id] ?? 0) < 1)
        setState(initRoundRobin(toLearn.length > 0 ? toLearn : populated.terms))
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [id])

  const word = state ? currentItem(state) : null
  const stage: Stage = state ? stageForRound(state.round) : 'mc'

  const mcOptions = useMemo(() => {
    if (!word || !set || stage !== 'mc') return [] as string[]
    const correct = word.translation || '—'
    const distractors = pickDistractors(set.terms, word, 3)
    const opts = [correct, ...distractors]
    // Shuffle
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[opts[i], opts[j]] = [opts[j], opts[i]]
    }
    return opts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word?.id, stage])

  const shakeIt = useCallback(() => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.5, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }, [shake])

  function nextItem(correct: boolean) {
    setPicked(null)
    setTyped('')
    setFeedback(null)
    setRevealed(false)
    setState((s) => {
      if (!s) return s
      return correct ? answerCorrect(s, adapter) : answerWrong(s, adapter)
    })
  }

  async function gradeMc(choice: string) {
    if (!word || !set || picked) return
    const correct = (word.translation || '') === choice
    setPicked(choice)
    setFeedback({ kind: correct ? 'ok' : 'wrong', expected: word.translation })
    if (correct) {
      await bumpMastery(set.id, word.id, 0.4)
    } else {
      await bumpMastery(set.id, word.id, -0.2)
      shakeIt()
    }
    setTimeout(() => nextItem(correct), correct ? 700 : 1400)
  }

  async function gradeTyped() {
    if (!word || !set || feedback) return
    const result = isAcceptableTyped(typed, word.translation || '')
    if (result === 'wrong') {
      setFeedback({ kind: 'wrong', expected: word.translation })
      await bumpMastery(set.id, word.id, -0.2)
      shakeIt()
      setTimeout(() => nextItem(false), 1500)
      return
    }
    if (result === 'close') {
      setFeedback({ kind: 'close', expected: word.translation })
      await bumpMastery(set.id, word.id, 0.15)
      setTimeout(() => nextItem(true), 1200)
      return
    }
    setFeedback({ kind: 'ok', expected: word.translation })
    await bumpMastery(set.id, word.id, 0.5)
    setTimeout(() => nextItem(true), 700)
  }

  async function gradeReveal(known: boolean) {
    if (!word || !set) return
    await bumpMastery(set.id, word.id, known ? 0.4 : -0.2)
    nextItem(known)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      </SafeAreaView>
    )
  }

  if (!set || !state || state.total === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.title}>Bu sette öğrenilecek terim yok</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.back()}>
            <Text style={styles.btnPrimaryText}>Sete dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (isComplete(state)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="trophy" size={56} color={colors.accent} />
          <Text style={styles.title}>Set öğrenildi!</Text>
          <Text style={styles.sub}>Tüm terimler {state.round}. round'da tamamlandı.</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace(`/sets/${set.id}`)}>
            <Text style={styles.btnPrimaryText}>Sete dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (!word) return null

  const prog = progress(state)

  const shakeX = shake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topTitle} numberOfLines={1}>{set.name}</Text>
          <Text style={styles.topSub}>Learn · Round {state.round}</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${prog.percent}%` }]} />
        </View>
        <Text style={styles.statsText}>{prog.mastered}/{prog.total}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.promptCard, { transform: [{ translateX: shakeX }] }]}>
          <View style={styles.promptHeader}>
            <View style={styles.stageBadge}>
              <Text style={styles.stageBadgeText}>
                {stage === 'mc' ? 'ÇOKTAN SEÇMELİ' : stage === 'typed' ? 'YAZ' : 'KENDİNİ DEĞERLENDİR'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => speak(word.word)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="volume-medium-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.promptWord}>{word.word}</Text>
          {word.ipa ? <Text style={styles.ipa}>/{word.ipa}/</Text> : null}
          {word.context && (stage === 'reveal' || revealed) ? (
            <Text style={styles.context}>{word.context}</Text>
          ) : null}
        </Animated.View>

        {/* Multiple choice */}
        {stage === 'mc' ? (
          <View style={styles.optionsCol}>
            {mcOptions.map((opt, i) => {
              const isCorrect = (word.translation || '') === opt
              const isPicked = picked === opt
              const showResult = !!picked
              const tint = !showResult
                ? null
                : isCorrect ? '#4ade80'
                : isPicked ? '#f87171'
                : null
              return (
                <Pressable
                  key={`${opt}-${i}`}
                  style={[
                    styles.optBtn,
                    isPicked && !showResult && { borderColor: colors.accent },
                    showResult && isCorrect && { borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.10)' },
                    showResult && isPicked && !isCorrect && { borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.10)' },
                  ]}
                  disabled={!!picked}
                  onPress={() => gradeMc(opt)}
                >
                  <View style={[styles.optLetter, tint && { borderColor: tint, backgroundColor: `${tint}22` }]}>
                    <Text style={[styles.optLetterText, tint && { color: tint }]}>
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <Text style={styles.optText}>{opt}</Text>
                  {showResult && isCorrect ? (
                    <Ionicons name="checkmark" size={18} color="#4ade80" />
                  ) : showResult && isPicked ? (
                    <Ionicons name="close" size={18} color="#f87171" />
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        ) : null}

        {/* Typed answer */}
        {stage === 'typed' ? (
          <View style={styles.typedBlock}>
            <Text style={styles.typedLabel}>Türkçesini yaz</Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder="..."
              placeholderTextColor={colors.textMuted}
              style={styles.typedInput}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!feedback}
              onSubmitEditing={gradeTyped}
              returnKeyType="done"
            />
            {feedback ? (
              <View style={[
                styles.feedbackBox,
                feedback.kind === 'ok' && { borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.10)' },
                feedback.kind === 'close' && { borderColor: '#fb923c', backgroundColor: 'rgba(251,146,60,0.10)' },
                feedback.kind === 'wrong' && { borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.10)' },
              ]}>
                <Text style={[
                  styles.feedbackTitle,
                  { color: feedback.kind === 'ok' ? '#4ade80' : feedback.kind === 'close' ? '#fb923c' : '#f87171' }
                ]}>
                  {feedback.kind === 'ok' ? 'Doğru!' : feedback.kind === 'close' ? 'Yaklaştın!' : 'Yanlış'}
                </Text>
                {feedback.expected ? (
                  <Text style={styles.feedbackExpected}>Doğru cevap: {feedback.expected}</Text>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btnPrimary, !typed.trim() && styles.btnDisabled]}
                onPress={gradeTyped}
                disabled={!typed.trim()}
              >
                <Text style={styles.btnPrimaryText}>Cevapla</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Reveal stage */}
        {stage === 'reveal' ? (
          <View style={styles.revealBlock}>
            {!revealed ? (
              <TouchableOpacity style={styles.revealBtn} onPress={() => setRevealed(true)}>
                <Ionicons name="eye-outline" size={18} color={colors.accent} />
                <Text style={styles.revealBtnText}>Cevabı gör</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.revealAnswer}>
                <Text style={styles.revealLabel}>CEVAP</Text>
                <Text style={styles.revealText}>{word.translation || '—'}</Text>
                <View style={styles.gradeRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionLeft]}
                    onPress={() => gradeReveal(false)}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#f87171" />
                    <Text style={[styles.actionText, { color: '#f87171' }]}>Bilemedim</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionRight]}
                    onPress={() => gradeReveal(true)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#4ade80" />
                    <Text style={[styles.actionText, { color: '#4ade80' }]}>Biliyordum</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10,
  },
  topTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  topSub: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 2 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, marginBottom: 14,
  },
  progressTrack: { flex: 1, height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  statsText: { color: colors.textMuted, fontSize: 11, fontWeight: '800', minWidth: 50, textAlign: 'right' },

  promptCard: {
    marginHorizontal: 20, marginBottom: 18, padding: 22,
    backgroundColor: colors.bgCard, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  promptHeader: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  stageBadge: {
    backgroundColor: colors.accentDim, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1, borderColor: 'rgba(250,204,21,0.22)',
  },
  stageBadgeText: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  promptWord: { color: colors.text, fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  ipa: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  context: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },

  optionsCol: { paddingHorizontal: 20, gap: 8 },
  optBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: colors.bgCard, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
  },
  optLetter: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  optLetterText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  optText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },

  typedBlock: { paddingHorizontal: 20, gap: 10 },
  typedLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  typedInput: {
    backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    color: colors.text, fontSize: 17,
  },
  feedbackBox: {
    borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4,
  },
  feedbackTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  feedbackExpected: { color: colors.text, fontSize: 13 },

  revealBlock: { paddingHorizontal: 20, gap: 10 },
  revealBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: 'rgba(250,204,21,0.22)',
  },
  revealBtnText: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  revealAnswer: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 16, gap: 10, alignItems: 'center',
  },
  revealLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  revealText: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  gradeRow: { flexDirection: 'row', gap: 10, width: '100%' },

  actionBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1,
  },
  actionLeft: { borderColor: 'rgba(248,113,113,0.34)', backgroundColor: 'rgba(248,113,113,0.10)' },
  actionRight: { borderColor: 'rgba(74,222,128,0.34)', backgroundColor: 'rgba(74,222,128,0.10)' },
  actionText: { fontSize: 13, fontWeight: '800' },

  btnPrimary: {
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
})
