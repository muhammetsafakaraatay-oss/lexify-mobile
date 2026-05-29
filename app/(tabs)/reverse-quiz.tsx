import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { FREE_LIMITS } from '../../lib/plan'
import { getTodayReverseQuizAttempts, incrementTodayReverseQuizAttempts } from '../../lib/usage'
import { usePremium } from '../../contexts/SubscriptionContext'
import { listUniqueSavedWords, SavedWord } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { evaluateReverseQuizAnswer, getReverseQuizPrompts, ReverseQuizEvaluation, ReverseQuizPrompt } from '../../lib/reverseQuiz'
import { StudyAmbient, StudyEmpty, StudyTopBar, StatChip } from '../../components/study/StudyChrome'

export default function ReverseQuizScreen() {
  const router = useRouter()
  const { isPro } = usePremium()
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [words, setWords] = useState<SavedWord[]>([])
  const [currentWord, setCurrentWord] = useState<SavedWord | null>(null)
  const [prompts, setPrompts] = useState<ReverseQuizPrompt[]>([])
  const [promptIndex, setPromptIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ReverseQuizEvaluation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [savedWords, todayAttempts] = await Promise.all([
      listUniqueSavedWords({ orderBy: 'review_count', ascending: true, limit: 24 }),
      getTodayReverseQuizAttempts(),
    ])
    setAttempts(todayAttempts)
    setLocked(!isPro && todayAttempts >= FREE_LIMITS.maxReverseQuizAttemptsPerDay)
    setWords(savedWords)
    setLoading(false)
  }, [isPro])

  useEffect(() => {
    void load()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const activePrompt = prompts[promptIndex] || null

  const prepareRound = useCallback(async (pool: SavedWord[]) => {
    if (!pool.length) return
    setResult(null)
    setAnswer('')
    const pick = pool[Math.floor(Math.random() * pool.length)]
    setCurrentWord(pick)
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id || 'guest'
    const nextPrompts = await getReverseQuizPrompts({ word: pick, userId, isPro })
    setPrompts(nextPrompts)
    setPromptIndex(0)
  }, [isPro])

  useEffect(() => {
    if (!loading && !currentWord && words.length) {
      void prepareRound(words)
    }
  }, [loading, currentWord, words, prepareRound])

  async function handleSubmit() {
    if (!currentWord || !activePrompt || submitting) return
    if (answer.trim().split(/\s+/).filter(Boolean).length < 3) return
    setSubmitting(true)
    try {
      const { data } = await supabase.auth.getUser()
      const userId = data.user?.id || 'guest'
      const evaluation = await evaluateReverseQuizAnswer({
        prompt: activePrompt,
        word: currentWord,
        answer,
        userId,
        isPro,
      })
      setResult(evaluation)
      if (!isPro) {
        const next = await incrementTodayReverseQuizAttempts()
        setAttempts(next)
        setLocked(next >= FREE_LIMITS.maxReverseQuizAttemptsPerDay)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleNext() {
    if (!currentWord) return
    if (prompts.length > 1 && promptIndex < prompts.length - 1) {
      setPromptIndex((prev) => prev + 1)
      setAnswer('')
      setResult(null)
      return
    }
    await prepareRound(words.filter((item) => item.id !== currentWord.id))
  }

  const totalScore = result?.total ?? 0
  const scoreTone = useMemo(() => {
    if (totalScore >= 80) return '#4ade80'
    if (totalScore >= 60) return colors.accent
    return '#f87171'
  }, [totalScore])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StudyAmbient />
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Çeviri modu hazırlanıyor</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (locked) {
    return (
      <SafeAreaView style={styles.container}>
        <StudyAmbient />
        <StudyTopBar title="Çeviri Modu" subtitle="Aktif üretim" onBack={() => router.back()} />
        <StudyEmpty
          icon="lock-closed"
          title="Bugünkü hak bitti"
          text={`Ücretsiz planda günde ${FREE_LIMITS.maxReverseQuizAttemptsPerDay} çeviri denemesi yapabilirsin. Pro ile sınırsız devam eder.`}
          actionLabel="Pro'yu Aç"
          onAction={() => router.push('/paywall')}
        />
      </SafeAreaView>
    )
  }

  if (words.length < 3 || !currentWord || !activePrompt) {
    return (
      <SafeAreaView style={styles.container}>
        <StudyAmbient />
        <StudyTopBar title="Çeviri Modu" subtitle="Aktif üretim" onBack={() => router.back()} />
        <StudyEmpty
          icon="albums-outline"
          title="Önce birkaç kelime gerek"
          text="Çeviri Modu için en az 3 kayıtlı kelime öneririm. Önce okurken birkaç kelime yakala."
          actionLabel="Oku ekranına git"
          onAction={() => router.push('/(tabs)/oku')}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StudyAmbient />
      <StudyTopBar title="Çeviri Modu" subtitle="Türkçe → İngilizce" onBack={() => router.back()} />

      <View style={styles.statsRow}>
        <StatChip icon="sparkles-outline" label="Hedef Kelime" value={currentWord.word} />
        <StatChip icon="create-outline" label="Bugün" value={isPro ? 'Sinirsiz' : `${attempts}/${FREE_LIMITS.maxReverseQuizAttemptsPerDay}`} tint="#60a5fa" />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.promptCard}>
          <Text style={styles.promptEyebrow}>ÇEVİRİ</Text>
          <Text style={styles.promptText}>{activePrompt.tr_sentence}</Text>
          <View style={styles.targetCard}>
            <Text style={styles.targetLabel}>Zorunlu kelime</Text>
            <Text style={styles.targetWord}>{currentWord.word}</Text>
            {currentWord.translation ? <Text style={styles.targetTranslation}>{currentWord.translation}</Text> : null}
          </View>
          <Text style={styles.promptFocus}>{activePrompt.focus}</Text>
        </View>

        <TextInput
          style={styles.answerInput}
          value={answer}
          onChangeText={setAnswer}
          multiline
          textAlignVertical="top"
          placeholder="İngilizce cümleni buraya yaz..."
          placeholderTextColor={colors.textMuted}
        />

        {!result ? (
          <TouchableOpacity
            style={[styles.submitBtn, answer.trim().split(/\s+/).filter(Boolean).length < 3 && styles.submitBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={submitting || answer.trim().split(/\s+/).filter(Boolean).length < 3}
          >
            {submitting ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.submitBtnText}>Gönder ve Puanla</Text>}
          </TouchableOpacity>
        ) : (
          <View style={styles.resultWrap}>
            <View style={styles.scoreHero}>
              <Text style={styles.scoreLabel}>TOPLAM SKOR</Text>
              <Text style={[styles.scoreValue, { color: scoreTone }]}>{result.total}</Text>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>Anlam</Text>
                <Text style={styles.breakdownValue}>{result.scores.semantic}/40</Text>
              </View>
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>Gramer</Text>
                <Text style={styles.breakdownValue}>{result.scores.grammar}/30</Text>
              </View>
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>Kelime</Text>
                <Text style={styles.breakdownValue}>{result.scores.word_usage}/30</Text>
              </View>
            </View>

            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackTitle}>Koç Yorumu</Text>
              <Text style={styles.feedbackText}>{result.feedback_tr}</Text>
            </View>

            {result.highlighted_errors.length ? (
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackTitle}>Dikkat Et</Text>
                {result.highlighted_errors.map((item, index) => (
                  <Text key={`${item.text}-${index}`} style={styles.errorLine}>• {item.text || 'Cümle'} — {item.issue}</Text>
                ))}
              </View>
            ) : null}

            {result.suggested_translations.length ? (
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackTitle}>Önerilen Çeviri</Text>
                {result.suggested_translations.map((item, index) => (
                  <Text key={`${item}-${index}`} style={styles.suggestionLine}>{item}</Text>
                ))}
              </View>
            ) : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setResult(null); setAnswer('') }}>
                <Text style={styles.secondaryBtnText}>Tekrar Dene</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleNext()}>
                <Text style={styles.primaryBtnText}>Sonraki</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  content: { padding: 16, paddingBottom: 32 },
  promptCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  promptEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  promptText: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 28, marginBottom: 14 },
  targetCard: { backgroundColor: colors.accentDim, borderRadius: 16, padding: 14, marginBottom: 12 },
  targetLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  targetWord: { color: colors.accent, fontSize: 22, fontWeight: '800' },
  targetTranslation: { color: colors.text, fontSize: 13, marginTop: 4 },
  promptFocus: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  answerInput: {
    minHeight: 160,
    backgroundColor: '#101010',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  resultWrap: { gap: 12 },
  scoreHero: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  scoreLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 6 },
  scoreValue: { fontSize: 42, fontWeight: '900' },
  breakdownRow: { flexDirection: 'row', gap: 10 },
  breakdownCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  breakdownTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  breakdownValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  feedbackCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },
  feedbackTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  feedbackText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  errorLine: { color: '#fda4af', fontSize: 13, lineHeight: 19, marginBottom: 6 },
  suggestionLine: { color: colors.text, fontSize: 13, lineHeight: 20, marginBottom: 6 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  secondaryBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  primaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  primaryBtnText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
})
