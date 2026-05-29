import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import { listVoiceSessions, type VoiceSession } from '../../../lib/voice'
import { PremiumGate } from '../../../components/PremiumGate'
import { usePremium } from '../../../contexts/SubscriptionContext'

export default function VoiceEchoArchiveScreen() {
  const router = useRouter()
  const { isPro, isLoading } = usePremium()
  const [sessions, setSessions] = useState<VoiceSession[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true)
        setSessions(await listVoiceSessions())
        setLoading(false)
      })()
    }, []),
  )

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!isPro) {
    return (
      <PremiumGate
        feature="voice"
        title="Sesli arsiv ve daha derin feedback"
        description="Kayitlarini sakla, onceki denemelerini tekrar dinle ve zayif telaffuzlarini biriktir."
      />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Sesli Arsiv</Text>
        <Text style={styles.subtitle}>Pro oturumlarin burada kalir. Skorunu ve transcript'ini istedigin zaman acabilirsin.</Text>

        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="mic-off-outline" size={34} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Henuz kayit yok</Text>
            <Text style={styles.emptySub}>Ilk sesli denemeni tamamladiginda burada goreceksin.</Text>
          </View>
        ) : (
          sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.row}
              onPress={() => router.push({ pathname: '/(tabs)/sesli/result', params: { id: session.id } })}
            >
              <View style={styles.icon}>
                <Ionicons name="mic-outline" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{session.targetWords.join(', ')}</Text>
                <Text style={styles.rowSub}>
                  {session.scores?.total ? `${session.scores.total}/100` : 'Analizsiz'} · {new Date(session.createdAt).toLocaleDateString('tr-TR')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  empty: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(37,99,235,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
})
