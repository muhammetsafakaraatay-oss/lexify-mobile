import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { listSavedWords } from '../../lib/data'
import { buildWidgetPreview, WidgetPreviewPayload } from '../../lib/widget'
import { colors } from '../../lib/theme'

export default function WidgetScreen() {
  const router = useRouter()
  const [preview, setPreview] = useState<WidgetPreviewPayload | null>(null)

  const load = useCallback(async () => {
    const words = await listSavedWords({ orderBy: 'due_at', ascending: true, limit: 20 })
    setPreview(buildWidgetPreview(words))
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Widget Hub</Text>
        <Text style={styles.subtitle}>Lock Screen widget’ta göstereceğin kelimenin ön izlemesi ve hazır veri katmanı.</Text>

        <View style={styles.previewShell}>
          <Text style={styles.previewLabel}>KÜÇÜK WIDGET ÖN İZLEME</Text>
          {preview ? (
            <>
              <Text style={styles.previewWord}>{preview.word}</Text>
              {preview.ipa ? <Text style={styles.previewIpa}>/{preview.ipa}/</Text> : null}
              <Text style={styles.previewTranslation}>{preview.translation}</Text>
              {preview.cefr ? <Text style={styles.previewCefr}>{preview.cefr}</Text> : null}
            </>
          ) : (
            <Text style={styles.previewTranslation}>Henüz gösterilecek kelime yok.</Text>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Native adım</Text>
          <Text style={styles.infoText}>
            JS tarafı hazır. Gerçek Lock Screen widget için sonraki adım WidgetKit extension ve App Group bağlamak olacak.
          </Text>
        </View>
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
  previewShell: { backgroundColor: '#111', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 22, minHeight: 190, justifyContent: 'center', marginBottom: 16 },
  previewLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 10 },
  previewWord: { color: colors.text, fontSize: 28, fontWeight: '900' },
  previewIpa: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  previewTranslation: { color: colors.accent, fontSize: 16, fontWeight: '700', marginTop: 10 },
  previewCefr: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  infoCard: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  infoTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 6 },
  infoText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
})
