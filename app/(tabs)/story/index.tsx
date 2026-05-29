import { useCallback, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import { getOrCreateWeeklyMicroStory, MicroStory, loadMicroStoryArchive } from '../../../lib/microStory'
import { listUniqueSavedWords } from '../../../lib/data'
import { supabase } from '../../../lib/supabase'
import { usePremium } from '../../../contexts/SubscriptionContext'

export default function StoryScreen() {
  const router = useRouter()
  const { isPro } = usePremium()
  const [story, setStory] = useState<MicroStory | null>(null)
  const [archiveCount, setArchiveCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [{ data: auth }, words] = await Promise.all([
        supabase.auth.getUser(),
        listUniqueSavedWords({ orderBy: 'created_at', ascending: false, limit: 32 }),
      ])
      const userId = auth.user?.id || 'guest'
      const [weekly, archive] = await Promise.all([
        getOrCreateWeeklyMicroStory({ savedWords: words, userId, isPro }),
        loadMicroStoryArchive(userId),
      ])
      setStory(weekly)
      setArchiveCount(archive.length)
    } catch (loadError) {
      console.warn('[story] load failed:', loadError)
      setError('Bu haftanın hikayesi hazırlanamadı. Birkaç yeni kelime kaydettikten sonra tekrar dene.')
    } finally {
      setLoading(false)
    }
  }, [isPro])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/story/archive')} style={styles.archiveBtn}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text style={styles.archiveBtnText}>Arşiv · {archiveCount}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Mikro Hikâye</Text>
        <Text style={styles.subtitle}>
          Bu hafta kaydettiğin kelimeler kısa bir hikâyede yeniden karşına çıkar. Amaç ezber değil, bağlam.
        </Text>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Bu haftanın hikâyesi hazırlanıyor...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="sparkles-outline" size={22} color={colors.accent} />
            <Text style={styles.errorTitle}>Hikâye hazır değil</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
              <Text style={styles.retryBtnText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        ) : story ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>BU HAFTA</Text>
              <Text style={styles.heroTitle}>{story.title}</Text>
              <Text style={styles.heroSummary}>{story.summaryTr}</Text>
            </View>

            <View style={styles.wordsRow}>
              {story.words.slice(0, 6).map((word) => (
                <View key={word} style={styles.wordPill}>
                  <Text style={styles.wordPillText}>{word}</Text>
                </View>
              ))}
            </View>

            <View style={styles.storyCard}>
              <Text style={styles.storyText}>{story.story}</Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)/flashcards')}>
              <Text style={styles.primaryBtnText}>Bu Kelimelerle Tekrar Yap</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(tabs)/oku')}>
              <Text style={styles.secondaryBtnText}>Yeni Okuma Aç</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  archiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  archiveBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 18 },
  loadingCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 24, alignItems: 'center', gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  errorCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 20, gap: 10 },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  errorText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  retryBtn: { marginTop: 6, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  retryBtnText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  heroCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18, marginBottom: 14 },
  heroEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  heroSummary: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  wordPill: { backgroundColor: colors.accentDim, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  wordPillText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  storyCard: { backgroundColor: '#101010', borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18, marginBottom: 16 },
  storyText: { color: colors.text, fontSize: 16, lineHeight: 28 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  secondaryBtn: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  secondaryBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },
})
