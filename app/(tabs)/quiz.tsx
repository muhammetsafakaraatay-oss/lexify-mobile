import { useEffect, useState, useRef } from 'react'
import * as Speech from 'expo-speech'

import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

interface Word { id: string; word: string; translation: string }
interface Slot { word: Word; key: string; side: 'en' | 'tr' }

const SLOT_COUNT = 6

export default function QuizScreen() {
  const [allWords, setAllWords] = useState<Word[]>([])
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

  const enFade = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(1)))
  const trFade = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(1)))
  const enScale = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(1)))
  const trScale = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(1)))
  const enShake = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(0)))
  const trShake = useRef(Array.from({ length: SLOT_COUNT }, () => new Animated.Value(0)))
  const progressAnim = useRef(new Animated.Value(0))

  useEffect(() => { loadWords() }, [])

  async function loadWords() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('saved_words').select('*').eq('user_id', user.id).order('review_count', { ascending: true }).limit(30)
    if (data && data.length >= 4) {
      const unique = data.filter((w, i, arr) => arr.findIndex(x => x.word.toLowerCase() === w.word.toLowerCase()) === i)
      setAllWords(unique)
      setTotalWords(unique.length)
      initSlots(unique, new Set())
    }
    setLoading(false)
  }

  function initSlots(words: Word[], used: Set<string>) {
    const available = words.filter(w => !used.has(w.id))
    const picked = [...available].sort(() => Math.random() - 0.5).slice(0, SLOT_COUNT)
    const enArr: (Slot | null)[] = Array(SLOT_COUNT).fill(null)
    const trArr: (Slot | null)[] = Array(SLOT_COUNT).fill(null)
    const shuffledEn = [...picked].sort(() => Math.random() - 0.5)
    const shuffledTr = [...picked].sort(() => Math.random() - 0.5)
    shuffledEn.forEach((w, i) => { enArr[i] = { word: w, key: `en-${w.id}-${Date.now()}-${i}`, side: 'en' } })
    shuffledTr.forEach((w, i) => { trArr[i] = { word: w, key: `tr-${w.id}-${Date.now()}-${i}`, side: 'tr' } })
    setEnSlots(enArr)
    setTrSlots(trArr)
  }

  function tapScale(anims: Animated.Value[], idx: number) {
    Animated.sequence([
      Animated.timing(anims[idx], { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(anims[idx], { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start()
  }

  function shakeAnim(enIdx: number, trIdx: number) {
    const shake = (anim: Animated.Value) => Animated.sequence([
      Animated.timing(anim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ])
    Animated.parallel([shake(enShake.current[enIdx]), shake(trShake.current[trIdx])]).start()
  }

  function matchAnimate(enIdx: number, trIdx: number, onDone: () => void) {
    Animated.parallel([
      Animated.timing(enFade.current[enIdx], { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(trFade.current[trIdx], { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(enScale.current[enIdx], { toValue: 0.7, duration: 300, useNativeDriver: true }),
      Animated.timing(trScale.current[trIdx], { toValue: 0.7, duration: 300, useNativeDriver: true }),
    ]).start(onDone)
  }

  function restoreSlot(enIdx: number, trIdx: number) {
    enFade.current[enIdx].setValue(0)
    trFade.current[trIdx].setValue(0)
    enScale.current[enIdx].setValue(0.7)
    trScale.current[trIdx].setValue(0.7)
    Animated.parallel([
      Animated.timing(enFade.current[enIdx], { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(trFade.current[trIdx], { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(enScale.current[enIdx], { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(trScale.current[trIdx], { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start()
  }

  useEffect(() => {
    if (selectedEn === null || selectedTr === null) return
    const enSlot = enSlots[selectedEn]
    const trSlot = trSlots[selectedTr]
    if (!enSlot || !trSlot) return

    if (enSlot.word.id === trSlot.word.id) {
      Speech.speak(enSlot.word.word, { language: 'en-US', rate: 0.9 })
      const eIdx = selectedEn, tIdx = selectedTr
      setSelectedEn(null); setSelectedTr(null)
      const newScore = score + 1
      setScore(newScore)
      Animated.timing(progressAnim.current, { toValue: newScore / totalWords, duration: 400, useNativeDriver: false }).start()

      matchAnimate(eIdx, tIdx, () => {
        const newUsed = new Set(usedIds)
        newUsed.add(enSlot.word.id)
        setUsedIds(newUsed)
        const available = allWords.filter(w => !newUsed.has(w.id))
        if (available.length === 0) { setFinished(true); return }
        const next = available[Math.floor(Math.random() * available.length)]
        setEnSlots(prev => { const n = [...prev]; n[eIdx] = { word: next, key: `en-${next.id}-${Date.now()}`, side: 'en' }; return n })
        setTrSlots(prev => { const n = [...prev]; n[tIdx] = { word: next, key: `tr-${next.id}-${Date.now()}`, side: 'tr' }; return n })
        restoreSlot(eIdx, tIdx)
      })
    } else {
      setWrongEn(selectedEn); setWrongTr(selectedTr)
      shakeAnim(selectedEn, selectedTr)
      setTimeout(() => { setWrongEn(null); setWrongTr(null); setSelectedEn(null); setSelectedTr(null) }, 700)
    }
  }, [selectedEn, selectedTr])

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  if (allWords.length < 4) return <View style={styles.center}><Text style={styles.emptyText}>En az 4 kelime gerekli</Text></View>

  if (finished) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={{ fontSize: 72, marginBottom: 16 }}>🎉</Text>
        <Text style={styles.finishTitle}>Tebrikler!</Text>
        <Text style={styles.finishSub}>{score} kelime eşleştirildi</Text>
        <TouchableOpacity style={styles.restartBtn} onPress={() => {
          setScore(0); setFinished(false); setUsedIds(new Set())
          progressAnim.current.setValue(0)
          enFade.current.forEach(a => a.setValue(1)); trFade.current.forEach(a => a.setValue(1))
          enScale.current.forEach(a => a.setValue(1)); trScale.current.forEach(a => a.setValue(1))
          loadWords()
        }}>
          <Text style={styles.restartBtnText}>Tekrar Oyna</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  const progressWidth = progressAnim.current.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Eşleşen çiftlere dokun</Text>
        <Text style={styles.score}>{score}/{totalWords}</Text>
      </View>

      <View style={styles.progressBg}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          {trSlots.map((slot, idx) => (
            <Animated.View key={slot?.key || `tr-empty-${idx}`} style={{ opacity: trFade.current[idx], transform: [{ scale: trScale.current[idx] }, { translateX: trShake.current[idx] }] }}>
              <TouchableOpacity
                style={[styles.card, selectedTr === idx && styles.cardSelected, wrongTr === idx && styles.cardWrong]}
                onPress={() => { if (slot) { tapScale(trScale.current, idx); setSelectedTr(idx) } }}
                activeOpacity={0.8}
              >
                <Text style={styles.cardText} numberOfLines={2}>{slot?.word.translation || ''}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <View style={styles.column}>
          {enSlots.map((slot, idx) => (
            <Animated.View key={slot?.key || `en-empty-${idx}`} style={{ opacity: enFade.current[idx], transform: [{ scale: enScale.current[idx] }, { translateX: enShake.current[idx] }] }}>
              <TouchableOpacity
                style={[styles.card, selectedEn === idx && styles.cardSelected, wrongEn === idx && styles.cardWrong]}
                onPress={() => { if (slot) { tapScale(enScale.current, idx); setSelectedEn(idx); Speech.speak(slot.word.word, { language: 'en-US', rate: 0.9 }) } }}
                activeOpacity={0.8}
              >
                <Text style={styles.cardText} numberOfLines={2}>{slot?.word.word || ''}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  score: { fontSize: 16, color: colors.accent, fontWeight: '700' },
  progressBg: { height: 6, backgroundColor: '#1a1a1a', marginHorizontal: 20, borderRadius: 3, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  columns: { flex: 1, flexDirection: 'row', paddingHorizontal: 12, gap: 10 },
  column: { flex: 1, gap: 10 },
  card: { backgroundColor: '#111', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#2a2a2a', minHeight: 64, justifyContent: 'center', alignItems: 'center' },
  cardSelected: { borderColor: colors.accent, backgroundColor: 'rgba(250,204,21,0.12)' },
  cardWrong: { borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.12)' },
  cardText: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 18, fontWeight: '700' },
  finishTitle: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  finishSub: { color: colors.textMuted, fontSize: 18, marginBottom: 24 },
  restartBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  restartBtnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
})
