import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listUniqueSavedWords, SavedWord } from '../../lib/dataApi'
import { colors } from '../../lib/theme'
import { cefrColors } from '../../lib/cefr'
import { speak } from '../../lib/speech'
import { Ionicons } from '@expo/vector-icons'

const MAX_HEARTS = 3
const TOTAL_ROUNDS = 10

type Direction = 'en→tr' | 'tr→en'
type Phase = 'picker' | 'session' | 'finished'
type CheckState = 'idle' | 'correct' | 'wrong'

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/[.,!?;:'"()]/g, '')
}

function isCorrect(input: string, target: string): boolean {
  const a = normalize(input)
  const b = normalize(target)
  if (a === b) return true
  // 1-char leeway for longer words
  if (b.length > 5 && Math.abs(a.length - b.length) <= 1) {
    let diffs = 0
    const shorter = a.length <= b.length ? a : b
    const longer  = a.length <= b.length ? b : a
    for (let i = 0, j = 0; i < longer.length && j < shorter.length; i++, j++) {
      if (longer[i] !== shorter[j]) { diffs++; if (longer.length > shorter.length) j-- }
      if (diffs > 1) return false
    }
    return diffs <= 1
  }
  return false
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

interface Round {
  word: SavedWord
  direction: Direction
  hint: string       // what's shown as the question
  answer: string     // what the user must type
  answerAlt?: string // optional acceptable alt (e.g. short form)
}

function buildRounds(words: SavedWord[], direction: Direction, count: number): Round[] {
  const pool = shuffle(words)
  const rounds: Round[] = []
  for (let i = 0; rounds.length < count && i < pool.length * 3; i++) {
    const word = pool[i % pool.length]
    if (!word.word || !word.translation) continue
    const dir = direction === 'en→tr'
      ? 'en→tr'
      : direction === 'tr→en'
        ? 'tr→en'
        : Math.random() > 0.5 ? 'en→tr' : 'tr→en'
    rounds.push({
      word,
      direction: dir,
      hint:   dir === 'en→tr' ? word.word : word.translation,
      answer: dir === 'en→tr' ? word.translation : word.word,
    })
  }
  return rounds.slice(0, count)
}

// ── Picker ────────────────────────────────────────────────────────────────────
function PickerScreen({ onStart }: { onStart: (dir: Direction) => void }) {
  const [dir, setDir] = useState<Direction>('en→tr')
  const opts: { value: Direction; label: string; sub: string; icon: string }[] = [
    { value: 'en→tr', label: 'İngilizce → Türkçe', sub: 'İngilizce kelimeyi gör, Türkçe yaz', icon: '🇬🇧' },
    { value: 'tr→en', label: 'Türkçe → İngilizce', sub: 'Türkçe çeviriyi gör, İngilizce yaz', icon: '🇹🇷' },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.pickerWrap}>
        <Text style={styles.pickerTitle}>Yazma Pratiği</Text>
        <Text style={styles.pickerSub}>Doğru cevabı yaz, öğren</Text>

        <Text style={styles.sectionLabel}>YÖN SEÇ</Text>
        <View style={styles.dirList}>
          {opts.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.dirCard, dir === o.value && styles.dirCardActive]}
              onPress={() => setDir(o.value)}
              activeOpacity={0.8}
            >
              <Text style={styles.dirEmoji}>{o.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dirLabel, dir === o.value && styles.dirLabelActive]}>{o.label}</Text>
                <Text style={styles.dirSub}>{o.sub}</Text>
              </View>
              {dir === o.value && (
                <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.rulesBox}>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleEmoji}>❤️</Text>
            <Text style={styles.ruleText}>{MAX_HEARTS} hakkın var — yanlış cevaplarda azalır</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleEmoji}>✅</Text>
            <Text style={styles.ruleText}>Küçük yazım hatalarına göz yumulur</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleEmoji}>🔊</Text>
            <Text style={styles.ruleText}>Doğru cevaplarda kelime seslendirilir</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={() => onStart(dir)} activeOpacity={0.85}>
          <Ionicons name="play" size={20} color={colors.bg} />
          <Text style={styles.startBtnText}>Başla</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function QuizScreen() {
  const [phase, setPhase] = useState<Phase>('picker')
  const [direction, setDirection] = useState<Direction>('en→tr')
  const [loading, setLoading] = useState(false)
  const [allWords, setAllWords] = useState<SavedWord[]>([])

  const [rounds, setRounds] = useState<Round[]>([])
  const [roundIdx, setRoundIdx] = useState(0)
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [input, setInput] = useState('')
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [hintUsed, setHintUsed] = useState(false)
  const [hintLevel, setHintLevel] = useState(0)

  const inputRef = useRef<TextInput>(null)
  const resultAnim = useRef(new Animated.Value(0)).current
  const shakeAnim  = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0)).current

  const round = rounds[roundIdx]

  useEffect(() => {
    listUniqueSavedWords({ orderBy: 'review_count', ascending: true, limit: 60 })
      .then(w => setAllWords(w))
      .catch(() => {})
  }, [])

  function handleStart(dir: Direction) {
    if (allWords.length < 3) return
    const built = buildRounds(allWords, dir, TOTAL_ROUNDS)
    setRounds(built)
    setRoundIdx(0)
    setHearts(MAX_HEARTS)
    setStreak(0)
    setScore(0)
    setInput('')
    setCheckState('idle')
    setHintUsed(false)
    setHintLevel(0)
    setDirection(dir)
    progressAnim.setValue(0)
    setPhase('session')
    resultAnim.setValue(0)
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  function runShake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start()
  }

  function showResult(correct: boolean) {
    resultAnim.setValue(0)
    Animated.spring(resultAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }).start()
    if (!correct) runShake()
  }

  function submitAnswer() {
    if (!round || checkState !== 'idle' || !input.trim()) return
    const correct = isCorrect(input, round.answer)

    if (correct) {
      setScore(s => s + (hintUsed ? 1 : 2))
      setStreak(s => s + 1)
      speak(round.word.word)
    } else {
      setHearts(h => Math.max(0, h - 1))
      setStreak(0)
    }

    setCheckState(correct ? 'correct' : 'wrong')
    showResult(correct)
  }

  function nextRound() {
    const newHeartsAfter = checkState === 'wrong' ? Math.max(0, hearts - 1) : hearts
    const isLast = roundIdx + 1 >= rounds.length
    const isDead = newHeartsAfter === 0 && checkState === 'wrong'

    if (isLast || isDead) {
      setPhase('finished')
      return
    }

    Animated.timing(progressAnim, {
      toValue: (roundIdx + 1) / rounds.length,
      duration: 400, useNativeDriver: false,
    }).start()

    resultAnim.setValue(0)
    setRoundIdx(i => i + 1)
    setInput('')
    setCheckState('idle')
    setHintUsed(false)
    setHintLevel(0)
    setTimeout(() => inputRef.current?.focus(), 150)
  }

  function useHint() {
    if (!round || hintLevel >= 3) return
    setHintUsed(true)
    setHintLevel(l => l + 1)
  }

  function getHintText(): string | null {
    if (!round || hintLevel === 0) return null
    const ans = round.answer
    if (hintLevel === 1) return `${ans.length} harf`
    if (hintLevel === 2) return `${ans[0].toUpperCase()}${'_'.repeat(ans.length - 1)}`
    return `${ans.slice(0, Math.ceil(ans.length / 2))}${'_'.repeat(Math.floor(ans.length / 2))}`
  }

  const hintText = getHintText()

  const resultScale   = resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] })
  const resultOpacity = resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  // ── Picker ──
  if (phase === 'picker') {
    if (allWords.length === 0) return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.emptyText}>Kelimeler yükleniyor...</Text>
      </View>
    )
    if (allWords.length < 3) return (
      <View style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📚</Text>
        <Text style={styles.emptyTitle}>Yeterli kelime yok</Text>
        <Text style={styles.emptyText}>Yazma pratiği için en az 3 kayıtlı kelime gerekli.</Text>
      </View>
    )
    return <PickerScreen onStart={handleStart} />
  }

  // ── Finished ──
  if (phase === 'finished') {
    const total = rounds.length
    const accuracy = total > 0 ? Math.round((score / (total * 2)) * 100) : 0
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.finishWrap}>
          <Text style={styles.finishEmoji}>{hearts === 0 ? '💔' : score >= total * 1.5 ? '🏆' : '🎉'}</Text>
          <Text style={styles.finishTitle}>{hearts === 0 ? 'Hakların bitti!' : 'Oturum tamamlandı!'}</Text>

          <View style={styles.finishStatsRow}>
            <View style={styles.finishStat}>
              <Text style={[styles.finishStatVal, { color: colors.accent }]}>{score}</Text>
              <Text style={styles.finishStatLabel}>puan</Text>
            </View>
            <View style={styles.finishStatDivider} />
            <View style={styles.finishStat}>
              <Text style={[styles.finishStatVal, { color: '#4ade80' }]}>{roundIdx}</Text>
              <Text style={styles.finishStatLabel}>tur</Text>
            </View>
            <View style={styles.finishStatDivider} />
            <View style={styles.finishStat}>
              {'❤️'.repeat(hearts).split('').map((_, i) => (
                <Text key={i} style={{ fontSize: 18 }}>❤️</Text>
              ))}
              {hearts === 0 && <Text style={[styles.finishStatVal, { color: '#f87171' }]}>0</Text>}
              <Text style={styles.finishStatLabel}>kalan hak</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.restartBtn} onPress={() => setPhase('picker')} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={18} color={colors.bg} />
            <Text style={styles.restartBtnText}>Tekrar Oyna</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (!round) return null

  const cefrColor = round.word.cefr ? cefrColors[round.word.cefr] : '#2a2a2a'

  // ── Session ──
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.container}>
        {/* Progress */}
        <View style={styles.progressBg}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => setPhase('picker')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="arrow-back-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.roundText}>{roundIdx + 1} / {rounds.length}</Text>
          </View>
          <View style={styles.headerRight}>
            {streak >= 2 && (
              <View style={styles.streakPill}>
                <Text>🔥</Text>
                <Text style={styles.streakNum}>{streak}</Text>
              </View>
            )}
            <View style={styles.heartsRow}>
              {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                <Text key={i} style={{ fontSize: 18, opacity: i < hearts ? 1 : 0.2 }}>❤️</Text>
              ))}
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.sessionWrap} keyboardShouldPersistTaps="handled">
          {/* Direction label */}
          <Text style={styles.directionLabel}>
            {round.direction === 'en→tr' ? '🇬🇧 → 🇹🇷 Türkçe yaz' : '🇹🇷 → 🇬🇧 İngilizce yaz'}
          </Text>

          {/* Question card */}
          <Animated.View style={[styles.questionCard, { borderColor: cefrColor + '55', transform: [{ translateX: shakeAnim }] }]}>
            {round.word.cefr ? (
              <View style={[styles.cefrBadge, { borderColor: cefrColor }]}>
                <Text style={[styles.cefrText, { color: cefrColor }]}>{round.word.cefr}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={() => speak(round.word.word)} style={styles.speakRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="volume-medium-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.questionText}>{round.hint}</Text>

            {round.word.context && round.direction === 'en→tr' ? (
              <Text style={styles.questionCtx} numberOfLines={2}>{round.word.context}</Text>
            ) : null}
          </Animated.View>

          {/* Hint */}
          {hintText ? (
            <View style={styles.hintBox}>
              <Ionicons name="bulb-outline" size={14} color={colors.accent} />
              <Text style={styles.hintText}>{hintText}</Text>
            </View>
          ) : null}

          {/* Input + submit */}
          {checkState === 'idle' ? (
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder={round.direction === 'en→tr' ? 'Türkçe cevabı yaz...' : 'English answer...'}
                placeholderTextColor="#444"
                value={input}
                onChangeText={setInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={submitAnswer}
              />
              <TouchableOpacity
                style={[styles.submitBtn, !input.trim() && styles.submitBtnDisabled]}
                onPress={submitAnswer}
                disabled={!input.trim()}
              >
                <Ionicons name="checkmark" size={22} color={input.trim() ? colors.bg : '#333'} />
              </TouchableOpacity>
            </View>
          ) : (
            <Animated.View style={[
              styles.resultBox,
              checkState === 'correct' ? styles.resultCorrect : styles.resultWrong,
              { transform: [{ scale: resultScale }], opacity: resultOpacity },
            ]}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name={checkState === 'correct' ? 'checkmark-circle' : 'close-circle'}
                  size={26}
                  color={checkState === 'correct' ? '#4ade80' : '#f87171'}
                />
                <Text style={[styles.resultLabel, { color: checkState === 'correct' ? '#4ade80' : '#f87171' }]}>
                  {checkState === 'correct' ? 'Doğru!' : 'Yanlış!'}
                </Text>
              </View>
              {checkState === 'wrong' && (
                <>
                  <Text style={styles.resultYours}>Yazdığın: <Text style={{ color: '#f87171' }}>{input}</Text></Text>
                  <Text style={styles.resultAnswer}>Doğrusu: <Text style={{ color: '#4ade80', fontWeight: '800' }}>{round.answer}</Text></Text>
                </>
              )}
              {checkState === 'correct' && (
                <Text style={styles.resultAnswerBig}>{round.answer}</Text>
              )}
            </Animated.View>
          )}

          {/* Action row */}
          <View style={styles.actionRow}>
            {checkState === 'idle' ? (
              <TouchableOpacity
                style={[styles.hintBtn, hintLevel >= 3 && styles.hintBtnDisabled]}
                onPress={useHint}
                disabled={hintLevel >= 3}
              >
                <Ionicons name="bulb-outline" size={16} color={hintLevel >= 3 ? '#333' : colors.accent} />
                <Text style={[styles.hintBtnText, hintLevel >= 3 && { color: '#333' }]}>
                  İpucu {hintLevel > 0 ? `(${3 - hintLevel} kaldı)` : ''}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.nextBtn} onPress={nextRound} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>
                  {roundIdx + 1 >= rounds.length ? 'Bitir' : 'Devam'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={colors.bg} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 12, padding: 32 },

  // Picker
  pickerWrap: { padding: 28, paddingTop: 40 },
  pickerTitle: { color: colors.text, fontSize: 32, fontWeight: '900', marginBottom: 6 },
  pickerSub: { color: colors.textMuted, fontSize: 15, marginBottom: 32 },
  sectionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  dirList: { gap: 12, marginBottom: 28 },
  dirCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#111', borderRadius: 18, padding: 18,
    borderWidth: 2, borderColor: '#1e1e1e',
  },
  dirCardActive: { borderColor: colors.accent, backgroundColor: 'rgba(250,204,21,0.07)' },
  dirEmoji: { fontSize: 28 },
  dirLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '800', marginBottom: 3 },
  dirLabelActive: { color: colors.accent },
  dirSub: { color: '#444', fontSize: 12 },
  rulesBox: { backgroundColor: '#0f0f0f', borderRadius: 16, padding: 18, gap: 12, marginBottom: 32, borderWidth: 1, borderColor: '#1a1a1a' },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleEmoji: { fontSize: 16, width: 24 },
  ruleText: { color: colors.textDim, fontSize: 13, lineHeight: 20, flex: 1 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.accent, borderRadius: 18, paddingVertical: 18 },
  startBtnText: { color: colors.bg, fontWeight: '900', fontSize: 18 },

  // Header
  progressBg: { height: 4, backgroundColor: '#1a1a1a' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundText: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  heartsRow: { flexDirection: 'row', gap: 4 },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251,146,60,0.12)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  streakNum: { color: '#fb923c', fontWeight: '800', fontSize: 14 },

  // Session
  sessionWrap: { padding: 20, paddingBottom: 40 },
  directionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 16, letterSpacing: 0.3 },
  questionCard: {
    backgroundColor: '#0f0f0f', borderWidth: 1.5, borderRadius: 24,
    padding: 28, alignItems: 'center', marginBottom: 16, minHeight: 150,
    justifyContent: 'center', gap: 8,
  },
  cefrBadge: { position: 'absolute', top: 14, left: 14, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  cefrText: { fontSize: 11, fontWeight: '800' },
  speakRow: { position: 'absolute', top: 14, right: 14 },
  questionText: { fontSize: 36, fontWeight: '900', color: colors.text, textAlign: 'center', lineHeight: 44 },
  questionCtx: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },

  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(250,204,21,0.08)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, alignSelf: 'center' },
  hintText: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  textInput: {
    flex: 1, backgroundColor: '#111', borderWidth: 1.5, borderColor: '#2a2a2a',
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14,
    color: colors.text, fontSize: 18, fontWeight: '600',
  },
  submitBtn: { width: 54, backgroundColor: colors.accent, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { backgroundColor: '#1a1a1a' },

  resultBox: { borderRadius: 18, padding: 20, marginBottom: 16, gap: 6 },
  resultCorrect: { backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.3)' },
  resultWrong: { backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1.5, borderColor: 'rgba(248,113,113,0.3)' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  resultLabel: { fontSize: 18, fontWeight: '800' },
  resultYours: { color: colors.textMuted, fontSize: 14 },
  resultAnswer: { color: colors.textDim, fontSize: 15 },
  resultAnswerBig: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },

  actionRow: { marginTop: 4 },
  hintBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: 'rgba(250,204,21,0.3)', borderRadius: 14, paddingVertical: 13 },
  hintBtnDisabled: { borderColor: '#222' },
  hintBtnText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16 },
  nextBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },

  // Finish
  finishWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  finishEmoji: { fontSize: 64, marginBottom: 16 },
  finishTitle: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  finishStatsRow: { flexDirection: 'row', backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 20, width: '100%' },
  finishStat: { flex: 1, alignItems: 'center', gap: 4 },
  finishStatVal: { fontSize: 28, fontWeight: '800' },
  finishStatLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  finishStatDivider: { width: 1, backgroundColor: '#1a1a1a' },
  restartBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 15 },
  restartBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },

  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
})
