import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Dimensions, ScrollView,
  Pressable, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  SavedWord, listDueWords, listNewWords, listSavedWords,
  gradeWord, getDueCount, srsStateOf,
} from '../../lib/dataApi'
import { Grade, previewGradeLabel } from '../../lib/srs'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { speak, cancelSpeech } from '../../lib/speech'
import { Ionicons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')
const CARD_W = Math.min(width - 40, 400)
const CARD_H = Math.min(height * 0.44, 320)

type Phase = 'picker' | 'session' | 'finished'
type StudyMode = 'flip' | 'write'
type QueueMode = 'due' | 'all'
type WriteState = 'idle' | 'correct' | 'wrong'

interface ResultRecord { wordId: string; wordText: string; grade: Grade }

const GRADES: { grade: Grade; label: string; color: string; bg: string }[] = [
  { grade: 'again', label: 'Tekrar', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  { grade: 'hard',  label: 'Zor',    color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  { grade: 'good',  label: 'İyi',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  { grade: 'easy',  label: 'Kolay',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
]

function stageLabel(stage: SavedWord['stage'] | undefined) {
  const map: Record<string, string> = {
    new: 'YENİ', learning: 'ÖĞRENİLİYOR', review: 'TEKRAR', mastered: 'ÖĞRENİLDİ', leech: 'ZOR KELİME',
  }
  return stage ? (map[stage] ?? stage.toUpperCase()) : 'YENİ'
}

function stageColor(stage: SavedWord['stage'] | undefined) {
  const map: Record<string, string> = {
    new: '#60a5fa', learning: '#facc15', review: '#4ade80', mastered: '#e879f9', leech: '#f87171',
  }
  return stage ? (map[stage] ?? colors.textMuted) : '#60a5fa'
}

function normalizeAnswer(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '')
}

function isClose(input: string, correct: string) {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(correct)
  if (a === b) return true
  // Allow 1-char typo for words > 4 letters
  if (b.length > 4) {
    let diff = 0
    const shorter = a.length < b.length ? a : b
    const longer  = a.length < b.length ? b : a
    if (longer.length - shorter.length > 1) return false
    for (let i = 0; i < longer.length; i++) {
      if (shorter[i] !== longer[i]) diff++
      if (diff > 1) return false
    }
    return true
  }
  return false
}

// ── Picker ────────────────────────────────────────────────────────────────────
function PickerScreen({
  dueCount, onStart,
}: {
  dueCount: number
  onStart: (sm: StudyMode, qm: QueueMode) => void
}) {
  const [studyMode, setStudyMode] = useState<StudyMode>('flip')
  const [queueMode, setQueueMode] = useState<QueueMode>(dueCount > 0 ? 'due' : 'all')

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.pickerWrap}>
        <Text style={styles.pickerTitle}>Çalışma Modu</Text>
        <Text style={styles.pickerSub}>Nasıl çalışmak istiyorsun?</Text>

        <View style={styles.modeGrid}>
          <TouchableOpacity
            style={[styles.modeCard, studyMode === 'flip' && styles.modeCardActive]}
            onPress={() => setStudyMode('flip')}
            activeOpacity={0.8}
          >
            <Text style={styles.modeEmoji}>🃏</Text>
            <Text style={[styles.modeCardTitle, studyMode === 'flip' && styles.modeCardTitleActive]}>Kart Çevir</Text>
            <Text style={styles.modeCardDesc}>Klasik flashcard, kendini puanla</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, studyMode === 'write' && styles.modeCardActive]}
            onPress={() => setStudyMode('write')}
            activeOpacity={0.8}
          >
            <Text style={styles.modeEmoji}>✍️</Text>
            <Text style={[styles.modeCardTitle, studyMode === 'write' && styles.modeCardTitleActive]}>Yaz</Text>
            <Text style={styles.modeCardDesc}>Türkçeyi gör, İngilizce yaz</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.pickerSectionLabel}>HANGİ KELİMELER</Text>
        <View style={styles.queueRow}>
          <TouchableOpacity
            style={[styles.queueBtn, queueMode === 'due' && styles.queueBtnActive]}
            onPress={() => setQueueMode('due')}
          >
            <Ionicons name="time-outline" size={16} color={queueMode === 'due' ? colors.accent : colors.textMuted} />
            <Text style={[styles.queueBtnText, queueMode === 'due' && styles.queueBtnTextActive]}>
              Günün Tekrarları {dueCount > 0 ? `(${dueCount})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.queueBtn, queueMode === 'all' && styles.queueBtnActive]}
            onPress={() => setQueueMode('all')}
          >
            <Ionicons name="layers-outline" size={16} color={queueMode === 'all' ? colors.accent : colors.textMuted} />
            <Text style={[styles.queueBtnText, queueMode === 'all' && styles.queueBtnTextActive]}>Tüm Kelimeler</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={() => onStart(studyMode, queueMode)} activeOpacity={0.85}>
          <Ionicons name="play" size={20} color={colors.bg} />
          <Text style={styles.startBtnText}>Başla</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function FlashcardsScreen() {
  const [phase, setPhase] = useState<Phase>('picker')
  const [studyMode, setStudyMode] = useState<StudyMode>('flip')
  const [queueMode, setQueueMode] = useState<QueueMode>('due')
  const [dueCount, setDueCount] = useState(0)

  const [queue, setQueue] = useState<SavedWord[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [finished, setFinished] = useState(false)
  const [results, setResults] = useState<ResultRecord[]>([])
  const [streak, setStreak] = useState(0)

  const [writeInput, setWriteInput] = useState('')
  const [writeState, setWriteState] = useState<WriteState>('idle')
  const writeRef = useRef<TextInput>(null)

  const [autoPlay, setAutoPlay] = useState(true)
  const autoPlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flipAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const gradeRowAnim = useRef(new Animated.Value(0)).current
  const writeResultAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    getDueCount().then(c => setDueCount(c.due + c.newWords)).catch(() => {})
  }, [])

  useEffect(() => {
    if (phase !== 'session' || !autoPlay || loading || finished || !queue[current]?.word) return
    if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current)
    autoPlayTimer.current = setTimeout(() => speak(queue[current].word), 350)
    return () => { if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current) }
  }, [current, queue, phase, loading, finished, autoPlay])

  useEffect(() => () => { cancelSpeech() }, [])

  const loadQueue = useCallback(async (sm: StudyMode, qm: QueueMode) => {
    setLoading(true)
    setFinished(false)
    setResults([])
    setStreak(0)
    setCurrent(0)
    setFlipped(false)
    setWriteInput('')
    setWriteState('idle')
    flipAnim.setValue(0)
    gradeRowAnim.setValue(0)

    let merged: SavedWord[] = []
    if (qm === 'all') {
      const all = await listSavedWords()
      merged = [...all].sort(() => Math.random() - 0.5).slice(0, 50)
    } else {
      const [counts, due, newer] = await Promise.all([getDueCount(), listDueWords(20), listNewWords(5)])
      setDueCount(counts.due + counts.newWords)
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

  function handleStart(sm: StudyMode, qm: QueueMode) {
    setStudyMode(sm)
    setQueueMode(qm)
    setPhase('session')
    loadQueue(sm, qm)
  }

  function advanceCard(grade?: Grade) {
    const word = queue[current]
    if (grade && word) {
      setResults(prev => [...prev, { wordId: word.id, wordText: word.word, grade }])
      setStreak(prev => grade === 'again' ? 0 : prev + 1)
      if (queueMode === 'due') {
        gradeWord(word, grade).catch(e => console.warn('[flashcards] gradeWord failed:', e))
      }
    }

    Animated.timing(slideAnim, {
      toValue: grade === 'again' ? -20 : 20,
      duration: 120, useNativeDriver: true,
    }).start(() => {
      flipAnim.setValue(0)
      gradeRowAnim.setValue(0)
      slideAnim.setValue(0)
      writeResultAnim.setValue(0)
      setFlipped(false)
      setWriteInput('')
      setWriteState('idle')
      if (current + 1 >= queue.length) {
        setPhase('finished')
        setFinished(true)
      } else {
        setCurrent(c => c + 1)
      }
    })
  }

  function flipCard() {
    if (flipped && queueMode === 'all') { advanceCard(); return }
    if (flipped) return
    Animated.spring(flipAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 40 }).start(() => {
      if (queueMode === 'due') {
        Animated.spring(gradeRowAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 60 }).start()
      }
    })
    setFlipped(true)
    speak(queue[current]?.word || '')
  }

  function submitWrite() {
    const word = queue[current]
    if (!word || writeState !== 'idle') return
    const correct = isClose(writeInput, word.word)
    setWriteState(correct ? 'correct' : 'wrong')
    Animated.spring(writeResultAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start()
    if (correct) speak(word.word)
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

  const frontRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const backRotate   = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [1, 1, 0, 0] })
  const backOpacity  = flipAnim.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [0, 0, 1, 1] })
  const gradeOpacity   = gradeRowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
  const gradeTranslate = gradeRowAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
  const resultScale    = writeResultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] })
  const resultOpacity  = writeResultAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })

  const cefrColor = word?.cefr ? cefrColors[word.cefr] : '#333'

  // ── Picker ──
  if (phase === 'picker') {
    return <PickerScreen dueCount={dueCount} onStart={handleStart} />
  }

  // ── Loading ──
  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.loadingText}>Kartlar hazırlanıyor...</Text>
    </View>
  )

  // ── Finished ──
  if (phase === 'finished') {
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
            {total === 0 ? 'Bugün tamamlandı!' : accuracy >= 80 ? 'Harika gitti!' : 'Oturum bitti!'}
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
                <Text style={styles.finishStatLabel}>en yüksek seri</Text>
              </View>
            </View>
          )}

          {total === 0 && (
            <Text style={styles.finishEmpty}>Şu an gözden geçirilecek kelime yok.{'\n'}Yeni kelimeler kaydet veya yarın gel.</Text>
          )}

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

          <TouchableOpacity style={styles.restartBtn} onPress={() => { setPhase('picker'); setFinished(false) }}>
            <Ionicons name="refresh-outline" size={18} color={colors.bg} />
            <Text style={styles.restartBtnText}>Yeni Oturum</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (!word) return null

  const progress = current / queue.length
  const isLeech = word.stage === 'leech'

  // ── Write mode ─────────────────────────────────────────────────────────────
  if (studyMode === 'write') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.container}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => setPhase('picker')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="arrow-back-outline" size={22} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.progressText}>{current + 1} / {queue.length}</Text>
              {streak > 1 && (
                <View style={styles.streakPill}>
                  <Text style={styles.streakFire}>🔥</Text>
                  <Text style={styles.streakNum}>{streak}</Text>
                </View>
              )}
            </View>
            <View style={[styles.stagePill, { borderColor: stageColor(word.stage) }]}>
              <Text style={[styles.stageText, { color: stageColor(word.stage) }]}>{stageLabel(word.stage)}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.writeArea} keyboardShouldPersistTaps="handled">
            <Text style={styles.writePrompt}>İngilizce'si nedir?</Text>

            {/* Translation shown big */}
            <View style={[styles.writeCard, { borderColor: cefrColor + '55' }]}>
              {word.cefr ? (
                <View style={[styles.cefrBadge, { borderColor: cefrColor }]}>
                  <Text style={[styles.cefrText, { color: cefrColor }]}>{word.cefr}</Text>
                </View>
              ) : null}
              <Text style={styles.writeCardTr}>{word.translation || '—'}</Text>
              {word.context ? (
                <Text style={styles.writeCardCtx} numberOfLines={2}>{word.context}</Text>
              ) : null}
            </View>

            {/* Input field */}
            {writeState === 'idle' ? (
              <View style={styles.writeInputRow}>
                <TextInput
                  ref={writeRef}
                  style={styles.writeInput}
                  placeholder="İngilizce kelimeyi yaz..."
                  placeholderTextColor="#444"
                  value={writeInput}
                  onChangeText={setWriteInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={submitWrite}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.writeSubmitBtn, !writeInput.trim() && styles.writeSubmitBtnDisabled]}
                  onPress={submitWrite}
                  disabled={!writeInput.trim()}
                >
                  <Ionicons name="checkmark" size={22} color={writeInput.trim() ? colors.bg : '#333'} />
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={[
                styles.writeResult,
                writeState === 'correct' ? styles.writeResultCorrect : styles.writeResultWrong,
                { transform: [{ scale: resultScale }], opacity: resultOpacity }
              ]}>
                <View style={styles.writeResultHeader}>
                  <Ionicons
                    name={writeState === 'correct' ? 'checkmark-circle' : 'close-circle'}
                    size={26}
                    color={writeState === 'correct' ? '#4ade80' : '#f87171'}
                  />
                  <Text style={[styles.writeResultLabel, { color: writeState === 'correct' ? '#4ade80' : '#f87171' }]}>
                    {writeState === 'correct' ? 'Doğru!' : 'Yanlış'}
                  </Text>
                </View>
                {writeState === 'wrong' ? (
                  <>
                    <Text style={styles.writeResultYours}>Yazdığın: <Text style={{ color: '#f87171' }}>{writeInput}</Text></Text>
                    <Text style={styles.writeResultCorrectWord}>Doğrusu: <Text style={{ color: '#4ade80', fontWeight: '800' }}>{word.word}</Text></Text>
                    {word.ipa ? <Text style={styles.writeResultIpa}>/{word.ipa}/</Text> : null}
                  </>
                ) : (
                  <>
                    <Text style={styles.writeResultAnswer}>{word.word}</Text>
                    {word.ipa ? <Text style={styles.writeResultIpa}>/{word.ipa}/</Text> : null}
                  </>
                )}
              </Animated.View>
            )}

            {writeState !== 'idle' && queueMode === 'due' ? (
              <Animated.View style={[
                styles.writeGradeRow,
                { opacity: resultOpacity }
              ]}>
                <Text style={styles.gradeLabel}>Kendini nasıl değerlendiriyorsun?</Text>
                <View style={styles.gradeRow}>
                  {GRADES.map(btn => (
                    <TouchableOpacity
                      key={btn.grade}
                      style={[styles.gradeBtn, { backgroundColor: btn.bg, borderColor: btn.color }]}
                      onPress={() => advanceCard(btn.grade)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.gradeBtnLabel, { color: btn.color }]}>{btn.label}</Text>
                      <Text style={styles.gradeBtnPreview}>{previews[btn.grade]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
            ) : writeState !== 'idle' ? (
              <TouchableOpacity style={styles.writeNextBtn} onPress={() => advanceCard(writeState === 'correct' ? 'good' : 'again')}>
                <Text style={styles.writeNextBtnText}>Devam</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.bg} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.writeSkipBtn} onPress={() => advanceCard()}>
              <Text style={styles.writeSkipText}>Atla</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    )
  }

  // ── Flip mode ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setPhase('picker')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.progressText}>{current + 1} / {queue.length}</Text>
          {streak > 1 && (
            <View style={styles.streakPill}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakNum}>{streak}</Text>
            </View>
          )}
          {queueMode === 'all' && (
            <View style={styles.modePill}>
              <Ionicons name="layers-outline" size={11} color={colors.accent} />
              <Text style={styles.modeText}>SERBEST</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.autoPlayBtn, autoPlay && styles.autoPlayBtnOn]}
            onPress={() => setAutoPlay(v => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={autoPlay ? 'volume-high-outline' : 'volume-mute-outline'}
              size={15}
              color={autoPlay ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.autoPlayText, autoPlay && styles.autoPlayTextOn]}>
              {autoPlay ? 'OTO' : 'SES'}
            </Text>
          </TouchableOpacity>
          <View style={[styles.stagePill, { borderColor: stageColor(word.stage) }]}>
            <Text style={[styles.stageText, { color: stageColor(word.stage) }]}>{stageLabel(word.stage)}</Text>
          </View>
        </View>
      </View>

      {isLeech && (
        <View style={styles.leechBanner}>
          <Ionicons name="warning-outline" size={14} color="#fca5a5" />
          <Text style={styles.leechText}>Bu kelime sana çok zor geliyor — örnekle birlikte ezberlemeyi dene.</Text>
        </View>
      )}

      <View style={styles.cardArea}>
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          <Pressable onPress={flipCard} style={styles.cardWrapper}>
            {/* Front */}
            <Animated.View style={[
              styles.card, styles.cardFront,
              { opacity: frontOpacity, transform: [{ rotateY: frontRotate }], borderColor: cefrColor + '44' }
            ]}>
              <View style={styles.cardTopRow}>
                {word.cefr ? (
                  <View style={[styles.cefrBadge, { borderColor: cefrColor }]}>
                    <Text style={[styles.cefrText, { color: cefrColor }]}>{word.cefr}</Text>
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
              { opacity: backOpacity, transform: [{ rotateY: backRotate }], borderColor: cefrColor + '66' }
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

              {queueMode === 'all' && (
                <View style={styles.flipHint}>
                  <Ionicons name="arrow-forward-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.flipHintText}>Sonraki için dokun</Text>
                </View>
              )}
            </Animated.View>
          </Pressable>
        </Animated.View>

        {!flipped && <Text style={styles.tapReminder}>Karta dokun → cevabı gör</Text>}
      </View>

      {queueMode === 'due' && (
        <Animated.View
          style={[styles.gradeArea, { opacity: gradeOpacity, transform: [{ translateY: gradeTranslate }] }]}
          pointerEvents={flipped ? 'auto' : 'none'}
        >
          <Text style={styles.gradeLabel}>Kendini nasıl değerlendiriyorsun?</Text>
          <View style={styles.gradeRow}>
            {GRADES.map(btn => (
              <TouchableOpacity
                key={btn.grade}
                style={[styles.gradeBtn, { backgroundColor: btn.bg, borderColor: btn.color }]}
                onPress={() => advanceCard(btn.grade)}
                activeOpacity={0.75}
              >
                <Text style={[styles.gradeBtnLabel, { color: btn.color }]}>{btn.label}</Text>
                <Text style={styles.gradeBtnPreview}>{previews[btn.grade]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 16 },
  loadingText: { color: colors.textMuted, fontSize: 14 },

  // ── Picker ──
  pickerWrap: { padding: 28, paddingTop: 40 },
  pickerTitle: { color: colors.text, fontSize: 32, fontWeight: '900', marginBottom: 6 },
  pickerSub: { color: colors.textMuted, fontSize: 15, marginBottom: 32 },
  pickerSectionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  modeGrid: { flexDirection: 'row', gap: 14, marginBottom: 32 },
  modeCard: {
    flex: 1, backgroundColor: '#111', borderRadius: 20, padding: 20,
    borderWidth: 2, borderColor: '#1e1e1e', alignItems: 'center', gap: 8,
  },
  modeCardActive: { borderColor: colors.accent, backgroundColor: 'rgba(250,204,21,0.07)' },
  modeEmoji: { fontSize: 36, marginBottom: 4 },
  modeCardTitle: { color: colors.textMuted, fontSize: 15, fontWeight: '800' },
  modeCardTitleActive: { color: colors.accent },
  modeCardDesc: { color: '#444', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  queueRow: { flexDirection: 'row', gap: 10, marginBottom: 36 },
  queueBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#1e1e1e', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  queueBtnActive: { borderColor: colors.accent, backgroundColor: 'rgba(250,204,21,0.07)' },
  queueBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', flex: 1 },
  queueBtnTextActive: { color: colors.accent },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.accent, borderRadius: 18,
    paddingVertical: 18,
  },
  startBtnText: { color: colors.bg, fontWeight: '900', fontSize: 18 },

  // ── Progress / Header ──
  progressBg: { height: 3, backgroundColor: '#1a1a1a' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(251,146,60,0.12)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  streakFire: { fontSize: 14 },
  streakNum: { color: '#fb923c', fontWeight: '800', fontSize: 14 },
  stagePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stageText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  modePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(250,204,21,0.1)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  modeText: { color: colors.accent, fontWeight: '800', fontSize: 10, letterSpacing: 0.6 },
  autoPlayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#222', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  autoPlayBtnOn: { borderColor: 'rgba(250,204,21,0.4)', backgroundColor: 'rgba(250,204,21,0.08)' },
  autoPlayText: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 },
  autoPlayTextOn: { color: colors.accent },

  leechBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, marginBottom: 8, backgroundColor: 'rgba(248,113,113,0.07)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)', borderRadius: 10, padding: 10 },
  leechText: { flex: 1, color: '#fca5a5', fontSize: 12, lineHeight: 18 },

  // ── Flip card ──
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  cardWrapper: { width: CARD_W, height: CARD_H },
  card: {
    width: '100%', height: '100%', borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    padding: 28, position: 'absolute', backfaceVisibility: 'hidden', borderWidth: 1.5,
  },
  cardFront: { backgroundColor: '#0f0f0f' },
  cardBack: { backgroundColor: '#0d0d0d' },
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

  // ── Grade buttons ──
  gradeArea: { paddingHorizontal: 16, paddingBottom: 20 },
  gradeLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center', marginBottom: 10 },
  gradeRow: { flexDirection: 'row', gap: 8 },
  gradeBtn: { flex: 1, borderWidth: 1.5, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 4 },
  gradeBtnLabel: { fontSize: 14, fontWeight: '800' },
  gradeBtnPreview: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  // ── Write mode ──
  writeArea: { padding: 20, paddingBottom: 40 },
  writePrompt: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginBottom: 16, textAlign: 'center' },
  writeCard: {
    backgroundColor: '#0f0f0f', borderWidth: 1.5, borderRadius: 24,
    padding: 28, alignItems: 'center', marginBottom: 20, gap: 10,
  },
  writeCardTr: { fontSize: 38, fontWeight: '800', color: colors.accent, textAlign: 'center', lineHeight: 46 },
  writeCardCtx: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  writeInputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  writeInput: {
    flex: 1, backgroundColor: '#111', borderWidth: 1.5, borderColor: '#2a2a2a',
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14,
    color: colors.text, fontSize: 18, fontWeight: '600',
  },
  writeSubmitBtn: {
    width: 54, backgroundColor: colors.accent, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  writeSubmitBtnDisabled: { backgroundColor: '#1a1a1a' },
  writeResult: { borderRadius: 18, padding: 20, marginBottom: 16, gap: 6 },
  writeResultCorrect: { backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.3)' },
  writeResultWrong: { backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1.5, borderColor: 'rgba(248,113,113,0.3)' },
  writeResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  writeResultLabel: { fontSize: 17, fontWeight: '800' },
  writeResultAnswer: { color: colors.text, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  writeResultYours: { color: colors.textMuted, fontSize: 14 },
  writeResultCorrectWord: { color: colors.textDim, fontSize: 15 },
  writeResultIpa: { color: '#555', fontSize: 13, fontFamily: 'Courier' },
  writeGradeRow: { marginTop: 4 },
  writeNextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.accent, borderRadius: 14, padding: 16, marginBottom: 12,
  },
  writeNextBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  writeSkipBtn: { alignItems: 'center', paddingVertical: 10 },
  writeSkipText: { color: '#333', fontSize: 13, fontWeight: '600' },

  // ── Finish screen ──
  finishWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  finishEmoji: { fontSize: 64, marginBottom: 16 },
  finishTitle: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  finishStatsRow: { flexDirection: 'row', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20, marginBottom: 20, width: '100%' },
  finishStat: { flex: 1, alignItems: 'center' },
  finishStatVal: { fontSize: 28, fontWeight: '800' },
  finishStatLabel: { fontSize: 11, color: colors.textMuted, marginTop: 3, fontWeight: '600' },
  finishStatDivider: { width: 1, backgroundColor: colors.border },
  finishEmpty: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  hardestBox: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 20, alignSelf: 'stretch' },
  hardestTitle: { color: colors.text, fontWeight: '700', marginBottom: 10, fontSize: 13, letterSpacing: 0.3 },
  hardestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  hardestItem: { color: colors.textDim, fontSize: 14 },
  restartBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 15 },
  restartBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
})
