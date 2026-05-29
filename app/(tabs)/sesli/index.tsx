import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { colors } from '../../../lib/theme'
import { listUniqueSavedWords } from '../../../lib/data'
import { buildVoicePrompt, getVoiceQuota, listVoiceSessions, saveVoiceDraft, type VoiceSession } from '../../../lib/voice'
import { usePremium } from '../../../contexts/SubscriptionContext'

export default function VoiceEchoHomeScreen() {
  const router = useRouter()
  const { isPro, isLoading: subLoading } = usePremium()
  const [loading, setLoading] = useState(true)
  const [targetWords, setTargetWords] = useState<string[]>([])
  const [promptText, setPromptText] = useState('')
  const [quotaText, setQuotaText] = useState('')
  const [canRecord, setCanRecord] = useState(true)
  const [recentSessions, setRecentSessions] = useState<VoiceSession[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [words, quota, sessions] = await Promise.all([
      listUniqueSavedWords({ limit: 24, orderBy: 'due_at', ascending: true }),
      getVoiceQuota(isPro),
      listVoiceSessions(),
    ])

    const prompt = buildVoicePrompt(words)
    setTargetWords(prompt.targetWords)
    setPromptText(prompt.promptText)
    setCanRecord(quota.canRecord)
    setQuotaText(
      isPro
        ? quota.canRecord
          ? 'Bugun 1 sesli pratik hakkin hazir.'
          : `Bugunku hakkin kullanildi, ${quota.resetLabel}.`
        : quota.canRecord
          ? 'Bu hafta 1 sesli pratik hakkin var.'
          : `Haftalik hakkin doldu, ${quota.resetLabel}.`,
    )
    setRecentSessions(sessions.slice(0, 3))
    setLoading(false)
  }, [isPro])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function handleStart() {
    if (!canRecord) {
      if (!isPro) {
        router.push('/paywall')
      }
      return
    }

    await saveVoiceDraft({
      targetWords,
      promptText,
      createdAt: new Date().toISOString(),
    })
    router.push('/(tabs)/sesli/recording')
  }

  if (subLoading || loading) {
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
        <Text style={styles.title}>Sesli Pratik</Text>
        <Text style={styles.subtitle}>
          Kendi sesinle konus, transcript al, hedef kelimeleri kullanip kullanmadigini kontrol et.
        </Text>

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}>
              <Ionicons name="mic-outline" size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>30 saniyelik mini konusma</Text>
              <Text style={styles.heroSub}>{quotaText}</Text>
            </View>
          </View>

          <View style={styles.wordWrap}>
            {targetWords.map((word) => (
              <View key={word} style={styles.wordChip}>
                <Text style={styles.wordChipText}>{word}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.promptLabel}>Bugunku prompt</Text>
          <Text style={styles.promptText}>{promptText}</Text>

          <TouchableOpacity
            style={[styles.cta, !canRecord && styles.ctaDisabled]}
            onPress={handleStart}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaText}>{canRecord ? 'Basla' : isPro ? 'Yarin tekrar dene' : "Pro'ya gec"}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.bg} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoValue}>3 adim</Text>
            <Text style={styles.infoLabel}>Kaydet → Transcript → Feedback</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoValue}>{isPro ? 'Pro' : 'Free'}</Text>
            <Text style={styles.infoLabel}>{isPro ? 'Gunluk 1 derin analiz' : 'Haftalik 1 deneme'}</Text>
          </View>
        </View>

        {recentSessions.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Son Denemeler</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/sesli/archive')}>
                <Text style={styles.sectionLink}>Arsiv →</Text>
              </TouchableOpacity>
            </View>
            {recentSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionRow}
                onPress={() => router.push({ pathname: '/(tabs)/sesli/result', params: { id: session.id } })}
              >
                <View style={styles.sessionIcon}>
                  <Ionicons name="time-outline" size={18} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionTitle}>{session.targetWords.join(', ')}</Text>
                  <Text style={styles.sessionSub}>
                    {session.scores?.total ? `${session.scores.total}/100 skor` : 'Analiz bekliyor'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  eyebrow: { color: '#2563EB', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  heroCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  heroHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  heroSub: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 18 },
  wordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordChip: {
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.25)',
  },
  wordChipText: { color: '#93C5FD', fontSize: 12, fontWeight: '800' },
  promptLabel: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  promptText: { color: colors.text, fontSize: 15, lineHeight: 24, fontWeight: '600' },
  cta: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { color: colors.bg, fontSize: 15, fontWeight: '900' },
  infoGrid: { flexDirection: 'row', gap: 10, marginTop: 16 },
  infoCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  infoValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  infoLabel: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  section: { marginTop: 24, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionLink: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  sessionRow: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.14)',
  },
  sessionTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sessionSub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
})
