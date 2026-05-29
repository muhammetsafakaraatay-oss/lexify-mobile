import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { speak } from '../../lib/speech'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { listUniqueSavedWords, SavedWord } from '../../lib/data'
import { colors } from '../../lib/theme'
import { cefrColors } from '../../lib/cefr'
import { FREE_LIMITS } from '../../lib/plan'
import { getTodayQuizSessions, incrementTodayQuizSessions } from '../../lib/usage'
import { usePremium } from '../../contexts/SubscriptionContext'
import { markQuizCompleted } from '../../lib/achievements'
import {
  StudyAmbient,
  StudyTopBar,
  StudyProgress,
  StatChip,
  SessionComplete,
  StudyEmpty,
} from '../../components/study/StudyChrome'

interface Slot {
  word: SavedWord
  key: string
  side: 'en' | 'tr'
}

const SLOT_COUNT = 6

export default function QuizScreen() {
  const router = useRouter()
  const { isPro } = usePremium()
  const [allWords, setAllWords] = useState<SavedWord[]>([])
  const [quizLocked, setQuizLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enSlots, setEnSlots] = useState<(Slot | null)[]>(Array(SLOT_COUNT).fill(null))
  const [trSlots, setTrSlots] = useState<(Slot | null)[]>(Array(SLOT_COUNT).fill(null))
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set())
  const [selectedEn, setSelectedEn] = useState<number | null>(null)
  const [selectedTr, setSelectedTr] = useState<number | null>(null)
  const [wrongEn, setWrongEn] = useState<number | null>(null)
  const [wrongTr, setWrongTr] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [finished, setFinished] = useState(false)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)

  const enFade = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(1)))
  const trFade = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(1)))
  const enScale = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(1)))
  const trScale = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(1)))
  const enShake = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(0)))
  const trShake = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(0)))
  const progressAnim = useRef(new Animated.Value(0))
  const matchPulse = useRef(new Animated.Value(0)).current

  const loadWords = useCallback(async () => {
    if (!isPro) {
      const sessions = await getTodayQuizSessions()
      if (sessions >= FREE_LIMITS.maxQuizSessionsPerDay) {
        setQuizLocked(true)
        setLoading(false)
        return
      }
    }

    const unique = await listUniqueSavedWords({ orderBy: 'review_count', ascending: true, limit: 30 })
    if (unique.length >= 4) {
      setAllWords(unique)
      setTotalWords(unique.length)
      initSlots(unique, new Set())
    }
    setLoading(false)
  }, [isPro])

  useEffect(() => {
    void loadWords()
  }, [loadWords])

  useFocusEffect(
    useCallback(() => {
      if (isPro) {
        setQuizLocked(false)
        return
      }
      void getTodayQuizSessions().then((sessions) => {
        setQuizLocked(sessions >= FREE_LIMITS.maxQuizSessionsPerDay)
      })
    }, [isPro]),
  )

  function initSlots(words: SavedWord[], used: Set<string>) {
    const available = words.filter((word) => !used.has(word.id))
    const picked = [...available].sort(() => Math.random() - 0.5).slice(0, SLOT_COUNT)
    const enArr: (Slot | null)[] = Array(SLOT_COUNT).fill(null)
    const trArr: (Slot | null)[] = Array(SLOT_COUNT).fill(null)
    const shuffledEn = [...picked].sort(() => Math.random() - 0.5)
    const shuffledTr = [...picked].sort(() => Math.random() - 0.5)

    shuffledEn.forEach((word, index) => {
      enArr[index] = { word, key: `en-${word.id}-${Date.now()}-${index}`, side: 'en' }
    })
    shuffledTr.forEach((word, index) => {
      trArr[index] = { word, key: `tr-${word.id}-${Date.now()}-${index}`, side: 'tr' }
    })

    setEnSlots(enArr)
    setTrSlots(trArr)
  }

  function tapScale(anims: Animated.Value[], idx: number) {
    Animated.sequence([
      Animated.timing(anims[idx], { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(anims[idx], { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start()
  }

  function shakeAnim(enIdx: number, trIdx: number) {
    const shake = (anim: Animated.Value) =>
      Animated.sequence([
        Animated.timing(anim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(anim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 8, duration: 45, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 45, useNativeDriver: true }),
      ])

    Animated.parallel([shake(enShake.current[enIdx]), shake(trShake.current[trIdx])]).start()
    setCombo(0)
  }

  function pulseMatch() {
    matchPulse.setValue(0)
    Animated.sequence([
      Animated.timing(matchPulse, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(matchPulse, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start()
  }

  function matchAnimate(enIdx: number, trIdx: number, onDone: () => void) {
    Animated.parallel([
      Animated.timing(enFade.current[enIdx], { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(trFade.current[trIdx], { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(enScale.current[enIdx], { toValue: 0.75, duration: 280, useNativeDriver: true }),
      Animated.timing(trScale.current[trIdx], { toValue: 0.75, duration: 280, useNativeDriver: true }),
    ]).start(onDone)
  }

  function restoreSlot(enIdx: number, trIdx: number) {
    enFade.current[enIdx].setValue(0)
    trFade.current[trIdx].setValue(0)
    enScale.current[enIdx].setValue(0.75)
    trScale.current[trIdx].setValue(0.75)

    Animated.parallel([
      Animated.spring(enFade.current[enIdx], { toValue: 1, useNativeDriver: true, friction: 8 }),
      Animated.spring(trFade.current[trIdx], { toValue: 1, useNativeDriver: true, friction: 8 }),
      Animated.spring(enScale.current[enIdx], { toValue: 1, useNativeDriver: true, friction: 8 }),
      Animated.spring(trScale.current[trIdx], { toValue: 1, useNativeDriver: true, friction: 8 }),
    ]).start()
  }

  useEffect(() => {
    if (selectedEn === null || selectedTr === null) return
    const enSlot = enSlots[selectedEn]
    const trSlot = trSlots[selectedTr]
    if (!enSlot || !trSlot) return

    if (enSlot.word.id === trSlot.word.id) {
      speak(enSlot.word.word, { rate: 0.9 })
      pulseMatch()
      const eIdx = selectedEn
      const tIdx = selectedTr
      setSelectedEn(null)
      setSelectedTr(null)
      const newScore = score + 1
      const newCombo = combo + 1
      setScore(newScore)
      setCombo(newCombo)
      setBestCombo((b) => Math.max(b, newCombo))
      if (!isPro && score === 0) {
        void incrementTodayQuizSessions()
      }
      Animated.timing(progressAnim.current, {
        toValue: newScore / totalWords,
        duration: 450,
        useNativeDriver: false,
      }).start()

      matchAnimate(eIdx, tIdx, () => {
        const newUsed = new Set(usedIds)
        newUsed.add(enSlot.word.id)
        setUsedIds(newUsed)
        const available = allWords.filter((word) => !newUsed.has(word.id))

        if (available.length === 0) {
          setFinished(true)
          void markQuizCompleted()
          return
        }

        const next = available[Math.floor(Math.random() * available.length)]
        setEnSlots((prev) => {
          const nextSlots = [...prev]
          nextSlots[eIdx] = { word: next, key: `en-${next.id}-${Date.now()}`, side: 'en' }
          return nextSlots
        })
        setTrSlots((prev) => {
          const nextSlots = [...prev]
          nextSlots[tIdx] = { word: next, key: `tr-${next.id}-${Date.now()}`, side: 'tr' }
          return nextSlots
        })
        restoreSlot(eIdx, tIdx)
      })
    } else {
      setWrongEn(selectedEn)
      setWrongTr(selectedTr)
      shakeAnim(selectedEn, selectedTr)
      setTimeout(() => {
        setWrongEn(null)
        setWrongTr(null)
        setSelectedEn(null)
        setSelectedTr(null)
      }, 650)
    }
  }, [selectedEn, selectedTr])

  const matchGlow = matchPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  })

  const remaining = Math.max(totalWords - score, 0)
  const accuracyPct = totalWords > 0 ? Math.round((score / totalWords) * 100) : 0

  const hint = useMemo(() => {
    if (score === 0) return 'Bir Türkçe ve bir İngilizce kart seç'
    if (finished) return 'Mükemmel — tüm kelimeler eşleşti'
    if (remaining <= 3) return 'Son birkaç kelime kaldı'
    if (combo >= 3) return `${combo}x combo — devam et!`
    return 'Yanlış eşleşme combo’yu sıfırlar'
  }, [combo, finished, remaining, score])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StudyAmbient />
        <View style={styles.center}>
          <View style={styles.loadingRing}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
          <Text style={styles.loadingText}>Quiz hazırlanıyor</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (quizLocked) {
    return (
      <SafeAreaView style={styles.container}>
        <StudyAmbient />
        <StudyTopBar title="Quiz" subtitle="Eşleştirme modu" onBack={() => router.back()} />
        <StudyEmpty
          icon="lock-closed"
          title="Günlük limit doldu"
          text={`Ücretsiz planda günde ${FREE_LIMITS.maxQuizSessionsPerDay} quiz oynayabilirsin. Pro ile sınırsız eşleştirme.`}
          actionLabel="Pro'yu Aç"
          onAction={() => router.push('/paywall')}
        />
      </SafeAreaView>
    )
  }

  if (allWords.length < 4) {
    return (
      <SafeAreaView style={styles.container}>
        <StudyAmbient />
        <StudyTopBar title="Quiz" onBack={() => router.back()} />
        <StudyEmpty
          icon="albums-outline"
          title="En az 4 kelime gerekli"
          text="Önce okurken birkaç kelime kaydet; sonra eşleştirme modu açılır."
          actionLabel="Okumaya Başla"
          onAction={() => router.push('/(tabs)/oku')}
        />
      </SafeAreaView>
    )
  }

  if (finished) {
    return (
      <SafeAreaView style={styles.container}>
        <StudyAmbient />
        <SessionComplete
          icon="checkmark-done-circle"
          iconColor="#4ade80"
          title="Quiz tamamlandı"
          subtitle={`${score} kelime eşleştirdin · En iyi combo: ${bestCombo}x`}
          stats={[
            { label: 'Skor', value: `${score}/${totalWords}`, color: colors.accent },
            { label: 'Doğruluk', value: `${accuracyPct}%`, color: '#4ade80' },
            { label: 'Combo', value: `${bestCombo}x`, color: '#fb923c' },
          ]}
          primaryLabel="Yeni Tur"
          onPrimary={() => {
            setScore(0)
            setCombo(0)
            setBestCombo(0)
            setFinished(false)
            setUsedIds(new Set())
            progressAnim.current.setValue(0)
            enFade.current.forEach((anim) => anim.setValue(1))
            trFade.current.forEach((anim) => anim.setValue(1))
            enScale.current.forEach((anim) => anim.setValue(1))
            trScale.current.forEach((anim) => anim.setValue(1))
            void loadWords()
          }}
          secondaryLabel="Çalış sekmesine dön"
          onSecondary={() => router.push('/(tabs)/study')}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StudyAmbient />

      <StudyTopBar
        title="Quiz"
        subtitle="Eşleştirme"
        onBack={() => router.back()}
        right={
          combo >= 2 ? (
            <View style={styles.comboPill}>
              <Text style={styles.comboText}>{combo}x</Text>
            </View>
          ) : (
            <View style={styles.backPlaceholder} />
          )
        }
      />

      <StudyProgress current={score} total={totalWords} label="Eşleşen" />

      <View style={styles.statsRow}>
        <StatChip icon="checkmark-circle-outline" label="Skor" value={`${score}`} />
        <StatChip icon="ellipse-outline" label="Kalan" value={`${remaining}`} tint="#60a5fa" />
        <StatChip icon="trophy-outline" label="Combo" value={`${combo}x`} tint="#fb923c" />
      </View>

      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textDim} />
        <Text style={styles.hintText}>{hint}</Text>
      </View>

      <Animated.View style={[styles.matchFlash, { opacity: matchGlow }]} pointerEvents="none" />

      <View style={styles.columnsHeader}>
        <View style={styles.columnLabel}>
          <Ionicons name="language-outline" size={14} color={colors.accent} />
          <Text style={styles.columnTitle}>Türkçe</Text>
        </View>
        <View style={styles.columnLabel}>
          <Ionicons name="text-outline" size={14} color="#60a5fa" />
          <Text style={styles.columnTitle}>English</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.columns}>
          <View style={styles.column}>
            {trSlots.map((slot, idx) => (
              <SlotCard
                key={slot?.key || `tr-${idx}`}
                slot={slot}
                side="tr"
                index={idx}
                selected={selectedTr === idx}
                wrong={wrongTr === idx}
                fade={trFade.current[idx]}
                scale={trScale.current[idx]}
                shake={trShake.current[idx]}
                onPress={() => {
                  if (!slot) return
                  tapScale(trScale.current, idx)
                  setSelectedTr(idx)
                }}
              />
            ))}
          </View>
          <View style={styles.column}>
            {enSlots.map((slot, idx) => (
              <SlotCard
                key={slot?.key || `en-${idx}`}
                slot={slot}
                side="en"
                index={idx}
                selected={selectedEn === idx}
                wrong={wrongEn === idx}
                fade={enFade.current[idx]}
                scale={enScale.current[idx]}
                shake={enShake.current[idx]}
                onPress={() => {
                  if (!slot) return
                  tapScale(enScale.current, idx)
                  setSelectedEn(idx)
                  speak(slot.word.word, { rate: 0.9 })
                }}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SlotCard({
  slot,
  side,
  selected,
  wrong,
  fade,
  scale,
  shake,
  onPress,
}: {
  slot: Slot | null
  side: 'en' | 'tr'
  index: number
  selected: boolean
  wrong: boolean
  fade: Animated.Value
  scale: Animated.Value
  shake: Animated.Value
  onPress: () => void
}) {
  if (!slot) return <View style={styles.slotPlaceholder} />

  const isEn = side === 'en'
  const cefr = slot.word.cefr

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ scale }, { translateX: shake }],
      }}
    >
      <TouchableOpacity
        style={[
          styles.slotCard,
          isEn ? styles.slotEn : styles.slotTr,
          selected && styles.slotSelected,
          wrong && styles.slotWrong,
        ]}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <View style={styles.slotTop}>
          <Text style={styles.slotSide}>{isEn ? 'EN' : 'TR'}</Text>
          {cefr ? (
            <View style={[styles.cefrPill, { borderColor: cefrColors[cefr] || colors.border }]}>
              <Text style={[styles.cefrText, { color: cefrColors[cefr] || colors.textMuted }]}>{cefr}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.slotText, isEn && styles.slotTextEn]} numberOfLines={3}>
          {isEn ? slot.word.word : slot.word.translation || '—'}
        </Text>
        {selected ? (
          <View style={styles.selectedDot}>
            <Ionicons name="radio-button-on" size={14} color={colors.accent} />
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(250,204,21,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  loadingText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  backPlaceholder: { width: 40 },
  comboPill: {
    backgroundColor: 'rgba(251,146,60,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  comboText: { color: '#fb923c', fontWeight: '900', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  hintText: { color: colors.textDim, fontSize: 12, fontWeight: '600', flex: 1 },
  matchFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#4ade80',
    zIndex: 0,
  },
  columnsHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 10,
    zIndex: 1,
  },
  columnLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  columnTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scroll: { flex: 1, zIndex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 28 },
  columns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1, gap: 10 },
  slotPlaceholder: { minHeight: 92, borderRadius: 18 },
  slotCard: {
    minHeight: 96,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  slotTr: {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
  },
  slotEn: {
    backgroundColor: '#0f1014',
    borderColor: '#2a2a30',
  },
  slotSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(250,204,21,0.1)',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
  },
  slotWrong: {
    borderColor: '#f87171',
    backgroundColor: 'rgba(248,113,113,0.1)',
  },
  slotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  slotSide: { color: colors.textDim, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  cefrPill: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 9, fontWeight: '800' },
  slotText: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 21, flex: 1 },
  slotTextEn: { fontSize: 16, letterSpacing: -0.2 },
  selectedDot: { position: 'absolute', top: 10, right: 10 },
})
