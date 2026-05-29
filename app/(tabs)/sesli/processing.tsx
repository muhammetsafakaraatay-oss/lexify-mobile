import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { colors } from '../../../lib/theme'
import { analyzeVoiceAttempt, transcribeVoice } from '../../../lib/api'
import { clearVoiceDraft, consumeVoiceQuota, getVoiceDraft, saveVoiceSession, type VoiceSession } from '../../../lib/voice'
import { usePremium } from '../../../contexts/SubscriptionContext'

export default function VoiceEchoProcessingScreen() {
  const router = useRouter()
  const { isPro } = usePremium()
  const [stage, setStage] = useState(0)
  const [error, setError] = useState('')
  const stages = useMemo(
    () => ['Transkripsiyon', 'Kelime kullanimi', 'Gramer ve akicilik'],
    [],
  )

  useEffect(() => {
    let cancelled = false

    async function run() {
      const draft = await getVoiceDraft()
      if (!draft) {
        router.replace('/(tabs)/sesli')
        return
      }

      try {
        setStage(0)
        const transcribeStartedAt = Date.now()
        const transcriptPayload = await transcribeVoice(draft.audioUri || '')
        const transcribeLatencyMs = Date.now() - transcribeStartedAt

        if (cancelled) return

        const transcript = transcriptPayload.text?.trim()
        const detectedLanguage = transcriptPayload.language || 'en'
        if (!transcript) {
          throw new Error('Ses kaydindan transcript cikaramadik.')
        }
        if (detectedLanguage && !detectedLanguage.toLowerCase().startsWith('en')) {
          throw new Error('Lutfen Ingilizce konus. Bu denemede baska bir dil algilandi.')
        }

        setStage(1)
        const durationSec = Math.max(5, Math.round((draft.audioDurationMs ?? 0) / 1000))
        const analyzeStartedAt = Date.now()
        const analysis = await analyzeVoiceAttempt({
          transcript,
          targetWords: draft.targetWords,
          promptText: draft.promptText,
          durationSec,
          detectedLanguage,
        })
        const analyzeLatencyMs = Date.now() - analyzeStartedAt

        if (cancelled) return

        setStage(2)
        const totalLatencyMs = transcribeLatencyMs + analyzeLatencyMs
        const transcriptWordCount = transcript.split(/\s+/).filter(Boolean).length
        const targetDetectedCount = analysis.word_checklist.filter((item) => item.used).length
        const llmTotalScore = analysis.scores.total
        const sessionId = `voice-${Date.now()}`
        console.info('[voice] latency', {
          transcribeLatencyMs,
          analyzeLatencyMs,
          totalLatencyMs,
        })
        console.info('[voice][qa]', {
          sessionId,
          targetWords: draft.targetWords.join(', '),
          transcriptWordCount,
          targetDetectedCount,
          llmTotalScore,
          transcribeLatencyMs,
          analyzeLatencyMs,
          totalLatencyMs,
        })

        const session: VoiceSession = {
          id: sessionId,
          status: 'completed',
          targetWords: draft.targetWords,
          promptText: draft.promptText,
          audioUri: isPro ? draft.audioUri : undefined,
          audioDurationMs: draft.audioDurationMs,
          audioSizeBytes: draft.audioSizeBytes,
          transcript,
          transcriptWordTimings: transcriptPayload.words,
          detectedLanguage,
          scores: analysis.scores,
          feedback: {
            word_checklist: analysis.word_checklist,
            grammar_issues: analysis.grammar_issues,
            feedback_tr: analysis.feedback_tr,
            encouragement_tr: analysis.encouragement_tr,
          },
          wordsPerMinute: Math.round((transcriptWordCount / durationSec) * 60),
          processingLatencyMs: {
            transcribe: transcribeLatencyMs,
            analyze: analyzeLatencyMs,
            total: totalLatencyMs,
          },
          createdAt: draft.createdAt,
          completedAt: new Date().toISOString(),
          isProSession: isPro,
        }

        await saveVoiceSession(session)
        await consumeVoiceQuota(isPro)
        await clearVoiceDraft()
        router.replace({ pathname: '/(tabs)/sesli/result', params: { id: session.id } })
      } catch (processingError: any) {
        console.warn('[voice] processing failed:', processingError)
        setError(processingError?.message || 'Ses analizi su an tamamlanamadi.')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [isPro, router])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>VOICE ECHO</Text>
        <Text style={styles.title}>Sesin analiz ediliyor</Text>
        <Text style={styles.subtitle}>
          Transcript cikariyor, hedef kelimeleri kontrol ediyor ve kisa bir koçluk notu hazirliyoruz.
        </Text>

        <View style={styles.card}>
          {error ? (
            <>
              <Text style={styles.errorTitle}>Bu denemeyi bitiremedik</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/(tabs)/sesli')}>
                <Text style={styles.retryText}>Yeni deneme hazirla</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator color="#2563EB" size="large" />
              <View style={styles.stageList}>
                {stages.map((label, index) => (
                  <View key={label} style={styles.stageRow}>
                    <View style={[styles.stageDot, index <= stage && styles.stageDotActive]} />
                    <Text style={[styles.stageText, index <= stage && styles.stageTextActive]}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  eyebrow: { color: '#2563EB', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center', marginBottom: 10 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12, marginBottom: 24 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 20,
  },
  stageList: { width: '100%', gap: 12 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  stageDotActive: { backgroundColor: '#2563EB' },
  stageText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  stageTextActive: { color: colors.text, fontWeight: '800' },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  errorText: { color: colors.textMuted, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  retryText: { color: colors.bg, fontSize: 14, fontWeight: '900' },
})
