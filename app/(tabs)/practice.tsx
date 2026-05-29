import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { listUniqueSavedWords, SavedWord } from '../../lib/data'
import { colors } from '../../lib/theme'
import { speak } from '../../lib/speech'
import { markPracticeCompleted } from '../../lib/achievements'
import { cefrColors } from '../../lib/cefr'

const SESSION_SIZE = 5

export default function PracticeScreen() {
  const router = useRouter()
  const [words, setWords] = useState<SavedWord[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)
  const [known, setKnown] = useState(0)
  const flipAnim = useRef(new Animated.Value(0)).current

  const load = useCallback(async () => {
    setLoading(true)
    setFinished(false)
    setIndex(0)
    setFlipped(false)
    setKnown(0)
    flipAnim.setValue(0)

    const all = await listUniqueSavedWords()
    const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE)
    setWords(shuffled)
    setLoading(false)
  }, [flipAnim])

  useEffect(() => { load() }, [load])

  function flip() {
    if (flipped) return
    setFlipped(true)
    Animated.spring(flipAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start()
  }

  function next(knewIt: boolean) {
    const nextKnown = knewIt ? known + 1 : known
    if (index + 1 >= words.length) {
      setKnown(nextKnown)
      finishSession(nextKnown)
      return
    }
    setKnown(nextKnown)
    setIndex((i) => i + 1)
    setFlipped(false)
    flipAnim.setValue(0)
  }

  async function finishSession(finalKnown: number) {
    setFinished(true)
    await markPracticeCompleted()
    void finalKnown
  }

  const current = words[index]
  const scale = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] })

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (words.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Henüz kelime yok</Text>
          <Text style={styles.emptySub}>Önce okurken birkaç kelime kaydet, sonra hızlı pratik yap.</Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/oku')}>
            <Text style={styles.ctaText}>Oku'ya Git</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Geri</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (finished) {
    const pct = Math.round((known / words.length) * 100)
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.doneEmoji}>🎯</Text>
          <Text style={styles.doneTitle}>Oturum bitti</Text>
          <Text style={styles.doneSub}>
            {known} / {words.length} kelimeyi bildin (%{pct})
          </Text>
          <TouchableOpacity style={styles.cta} onPress={load}>
            <Text style={styles.ctaText}>Tekrar Oyna</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push('/(tabs)/flashcards')}>
            <Text style={styles.ctaSecondaryText}>Flashcard'a Geç</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Ana sayfaya dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hızlı Pratik</Text>
        <Text style={styles.progress}>{index + 1} / {words.length}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((index + 1) / words.length) * 100}%` }]} />
      </View>

      <View style={styles.cardArea}>
        <TouchableOpacity activeOpacity={0.95} onPress={flip}>
          <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
            {!flipped ? (
              <>
                <View style={styles.cardTop}>
                  {current.cefr ? (
                    <View style={[styles.cefr, { borderColor: cefrColors[current.cefr] }]}>
                      <Text style={[styles.cefrText, { color: cefrColors[current.cefr] }]}>{current.cefr}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => speak(current.word)}
                    hitSlop={12}
                  >
                    <Ionicons name="volume-medium-outline" size={26} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.wordEn}>{current.word}</Text>
                <Text style={styles.hint}>Anlamı görmek için dokun</Text>
              </>
            ) : (
              <>
                <Text style={styles.wordTr}>{current.translation || '—'}</Text>
                <Text style={styles.wordEnSmall}>{current.word}</Text>
                {current.context ? (
                  <Text style={styles.context} numberOfLines={3}>{current.context}</Text>
                ) : null}
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </View>

      {flipped ? (
        <View style={styles.gradeRow}>
          <TouchableOpacity style={[styles.gradeBtn, styles.gradeAgain]} onPress={() => next(false)}>
            <Ionicons name="close" size={20} color="#f87171" />
            <Text style={[styles.gradeText, { color: '#f87171' }]}>Bilmiyorum</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gradeBtn, styles.gradeGood]} onPress={() => next(true)}>
            <Ionicons name="checkmark" size={20} color="#4ade80" />
            <Text style={[styles.gradeText, { color: '#4ade80' }]}>Biliyorum</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.footerHint}>Kartı çevir, sonra kendini değerlendir</Text>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  headerTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '800' },
  progress: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  progressBar: { height: 3, backgroundColor: '#1a1a1a', marginHorizontal: 20 },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  cardArea: { flex: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 28,
    minHeight: 220,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  cefr: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  cefrText: { fontSize: 11, fontWeight: '700' },
  wordEn: { fontSize: 36, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  wordTr: { fontSize: 28, fontWeight: '800', color: colors.accent, marginBottom: 8 },
  wordEnSmall: { fontSize: 16, color: colors.textMuted, fontWeight: '600', marginBottom: 12 },
  context: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: 20 },
  footerHint: { color: colors.textDim, textAlign: 'center', paddingBottom: 28, fontSize: 13 },
  gradeRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 28 },
  gradeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  gradeAgain: { borderColor: 'rgba(248,113,113,0.35)', backgroundColor: 'rgba(248,113,113,0.08)' },
  gradeGood: { borderColor: 'rgba(74,222,128,0.35)', backgroundColor: 'rgba(74,222,128,0.08)' },
  gradeText: { fontWeight: '800', fontSize: 15 },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  emptySub: { color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  doneSub: { color: colors.textMuted, fontSize: 16, marginBottom: 24 },
  cta: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, marginBottom: 10 },
  ctaText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  ctaSecondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 16 },
  ctaSecondaryText: { color: colors.text, fontWeight: '700' },
  backLink: { padding: 12 },
  backLinkText: { color: colors.textMuted, fontWeight: '600' },
})
