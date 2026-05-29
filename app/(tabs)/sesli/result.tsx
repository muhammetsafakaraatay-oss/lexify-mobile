import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import { getVoiceSession, type VoiceSession } from '../../../lib/voice'
import { ScoreCircle } from '../../../components/voice/ScoreCircle'
import { WordChecklist } from '../../../components/voice/WordChecklist'
import { FeedbackCard } from '../../../components/voice/FeedbackCard'

export default function VoiceEchoResultScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const [session, setSession] = useState<VoiceSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      if (!params.id) {
        router.replace('/(tabs)/sesli')
        return
      }
      const data = await getVoiceSession(String(params.id))
      if (!data) {
        router.replace('/(tabs)/sesli')
        return
      }
      setSession(data)
      setLoading(false)
    })()
  }, [params.id, router])

  if (loading || !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>VOICE ECHO</Text>
        <Text style={styles.title}>Sonuc Hazir</Text>
        <Text style={styles.subtitle}>Bu denemede transcript, hedef kelime kullanimi ve akicilik gorusunu topladik.</Text>

        <View style={styles.scoreWrap}>
          <ScoreCircle score={session.scores?.total ?? 0} />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{session.wordsPerMinute ?? 0}</Text>
            <Text style={styles.metricLabel}>kelime / dk</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{session.scores?.grammar ?? 0}</Text>
            <Text style={styles.metricLabel}>gramer</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{session.scores?.fluency ?? 0}</Text>
            <Text style={styles.metricLabel}>akicilik</Text>
          </View>
        </View>

        <WordChecklist items={session.feedback?.word_checklist ?? []} />

        <FeedbackCard
          title="AI Koc Notu"
          body={session.feedback?.feedback_tr || 'Bu denemeye ait ozet not henuz olusmadi.'}
        />
        <FeedbackCard
          title="Tesvik"
          body={session.feedback?.encouragement_tr || 'Bir deneme daha yap ve farki karsilastir.'}
        />

        {(session.feedback?.grammar_issues?.length ?? 0) > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gramer Duzeltmeleri</Text>
            {session.feedback?.grammar_issues.map((issue, index) => (
              <View key={`${issue.original}-${index}`} style={styles.issueRow}>
                <Text style={styles.issueOriginal}>{issue.original}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                <Text style={styles.issueFix}>{issue.correction}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transcript</Text>
          <Text style={styles.transcript}>{session.transcript || 'Transcript bulunamadi.'}</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/sesli')}>
            <Text style={styles.secondaryText}>Yeni Prompt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)/sesli/archive')}>
            <Text style={styles.primaryText}>Arsiv</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: 16 },
  eyebrow: { color: '#2563EB', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  scoreWrap: { alignItems: 'center', marginVertical: 4 },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  metricValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  issueOriginal: { color: '#F59E0B', fontSize: 13, fontWeight: '700' },
  issueFix: { color: '#4ADE80', fontSize: 13, fontWeight: '700' },
  transcript: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: '900' },
})
