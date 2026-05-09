import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import * as Speech from 'expo-speech'
import { recordActivity } from '../../lib/streak'
import { refreshScheduledReminders } from '../../lib/notifications'

const { width } = Dimensions.get('window')

interface Word {
  id: string; word: string; translation: string
  context?: string; mastered: boolean; review_count: number; cefr?: string
}

export default function FlashcardsScreen() {
  const [words, setWords] = useState<Word[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [streak, setStreak] = useState(0)
  const [results, setResults] = useState<Record<string, 'know' | 'dontknow'>>({})
  const flipAnim = useRef(new Animated.Value(0)).current

  const cefrColor: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  useEffect(() => { loadWords() }, [])

  async function loadWords() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('saved_words').select('*').eq('user_id', user.id)
      .order('review_count', { ascending: true }).limit(20)
    if (data) {
      const unique = data.filter((w, i, arr) =>
        arr.findIndex(x => x.word.toLowerCase() === w.word.toLowerCase()) === i
      )
      setWords([...unique].sort(() => Math.random() - 0.5))
    }
    setLoading(false)
  }

  function flipCard() {
    const toValue = flipped ? 0 : 1
    Animated.spring(flipAnim, { toValue, useNativeDriver: true, friction: 8, tension: 10 }).start()
    setFlipped(!flipped)
  }

  async function handleResult(result: 'know' | 'dontknow') {
    const word = words[current]
    setResults(p => ({ ...p, [word.id]: result }))
    const { data: { user } } = await supabase.auth.getUser()

    if (result === 'know') {
      setStreak(s => s + 1)
      const newCount = (word.review_count || 0) + 1
      await supabase.from('saved_words').update({ review_count: newCount, mastered: newCount >= 3 }).eq('id', word.id).eq('user_id', user!.id)
    } else {
      setStreak(0)
      await supabase.from('saved_words').update({ review_count: Math.max(0, (word.review_count || 0) - 1) }).eq('id', word.id).eq('user_id', user!.id)
    }

    await recordActivity({ reviewsDelta: 1 })

    Animated.timing(flipAnim, { toValue: 0, duration: 0, useNativeDriver: true }).start()
    setFlipped(false)

    if (current + 1 >= words.length) {
      setFinished(true)
      await refreshScheduledReminders()
    } else {
      setCurrent(c => c + 1)
    }
  }

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [1, 1, 0, 0] })
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.5, 1], outputRange: [0, 0, 1, 1] })

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  if (words.length === 0) return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>Henüz kelime eklemediniz</Text>
    </View>
  )

  if (finished) {
    const known = Object.values(results).filter(r => r === 'know').length
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.finishEmoji}>🎉</Text>
          <Text style={styles.finishTitle}>Tebrikler!</Text>
          <Text style={styles.finishSub}>{known}/{Object.values(results).length} kelime bildiniz</Text>
          {streak > 2 && <Text style={styles.streakText}>🔥 {streak} seri!</Text>}
          <TouchableOpacity style={styles.restartBtn} onPress={() => {
            setCurrent(0); setFlipped(false); setFinished(false)
            setResults({}); setStreak(0); flipAnim.setValue(0); loadWords()
          }}>
            <Text style={styles.restartBtnText}>Tekrar Çalış</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const word = words[current]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progress}>{current + 1} / {words.length}</Text>
        {streak > 1 && <Text style={styles.streakBadge}>🔥 {streak}</Text>}
      </View>

      <View style={styles.cardArea}>
        <TouchableOpacity onPress={flipCard} activeOpacity={0.95} style={styles.cardWrapper}>
          <Animated.View style={[styles.card, styles.cardFront, { opacity: frontOpacity, transform: [{ rotateY: frontRotate }] }]}>
            <Text style={styles.cardWord}>{word.word}</Text>
            {word.cefr && (
              <View style={[styles.cefrBadge, { borderColor: cefrColor[word.cefr] }]}>
                <Text style={[styles.cefrText, { color: cefrColor[word.cefr] }]}>{word.cefr}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => Speech.speak(word.word, { language: 'en-US', rate: 0.8 })} style={styles.speakBtn}>
              <Text style={styles.speakText}>🔊</Text>
            </TouchableOpacity>
            <Text style={styles.tapHint}>Çevirmek için dokun</Text>
          </Animated.View>

          <Animated.View style={[styles.card, styles.cardBack, { opacity: backOpacity, transform: [{ rotateY: backRotate }] }]}>
            <Text style={styles.cardTranslation}>{word.translation}</Text>
            {word.context ? <Text style={styles.cardContext}>{word.context}</Text> : null}
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.dontknowBtn} onPress={() => handleResult('dontknow')}>
          <Text style={styles.btnText}>✗ Bilmiyorum</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.knowBtn} onPress={() => handleResult('know')}>
          <Text style={styles.btnText}>✓ Biliyorum</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  progress: { color: colors.textMuted, fontSize: 16 },
  streakBadge: { fontSize: 18 },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cardWrapper: { width: width - 48, height: 280 },
  card: { width: '100%', height: '100%', borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 32, position: 'absolute', backfaceVisibility: 'hidden' },
  cardFront: { backgroundColor: '#111', borderWidth: 1, borderColor: colors.border },
  cardBack: { backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: colors.accent },
  cardWord: { fontSize: 36, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 12 },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16 },
  cefrText: { fontSize: 12, fontWeight: '700' },
  speakBtn: { marginBottom: 16 },
  speakText: { fontSize: 28 },
  tapHint: { color: colors.textMuted, fontSize: 13 },
  cardTranslation: { fontSize: 32, fontWeight: '700', color: colors.accent, textAlign: 'center', marginBottom: 12 },
  cardContext: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  buttons: { flexDirection: 'row', gap: 12, padding: 24 },
  dontknowBtn: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f87171' },
  knowBtn: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#4ade80' },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  emptyText: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },
  finishEmoji: { fontSize: 64, marginBottom: 16 },
  finishTitle: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  finishSub: { color: colors.textMuted, fontSize: 18, marginBottom: 24 },
  streakText: { color: colors.accent, fontSize: 20, marginBottom: 24 },
  restartBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  restartBtnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
})
