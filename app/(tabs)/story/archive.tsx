import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import { loadMicroStoryArchive, MicroStory } from '../../../lib/microStory'
import { supabase } from '../../../lib/supabase'

export default function StoryArchiveScreen() {
  const router = useRouter()
  const [stories, setStories] = useState<MicroStory[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id || 'guest'
    setStories(await loadMicroStoryArchive(userId))
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Hikâye Arşivi</Text>
        <Text style={styles.subtitle}>Üretilen haftalık hikâyeleri burada tekrar okuyabilirsin.</Text>

        {stories.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Henüz arşiv yok</Text>
            <Text style={styles.emptyText}>İlk hikâyen üretildiğinde burada görünecek.</Text>
          </View>
        ) : (
          stories.map((story) => (
            <View key={story.id} style={styles.storyCard}>
              <Text style={styles.storyDate}>{new Date(story.createdAt).toLocaleDateString('tr-TR')}</Text>
              <Text style={styles.storyTitle}>{story.title}</Text>
              <Text style={styles.storySummary}>{story.summaryTr}</Text>
              <Text style={styles.storyBody} numberOfLines={5}>{story.story}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 18 },
  emptyCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 20 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  storyCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 12 },
  storyDate: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  storyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  storySummary: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  storyBody: { color: colors.text, fontSize: 14, lineHeight: 22 },
})
