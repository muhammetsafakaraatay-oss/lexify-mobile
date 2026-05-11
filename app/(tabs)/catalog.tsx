import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { getArticles } from '../../lib/api'
import { cefrColors, cefrLevels } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Article {
  id: string; title: string; url: string; source: string
  cefr_level: string; description: string; image_url: string
}

export default function CatalogScreen() {
  const [articles, setArticles] = useState<Article[]>([])
  const [filtered, setFiltered] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState('Tümü')
  const router = useRouter()

  useEffect(() => { loadArticles() }, [])
  useEffect(() => {
    setFiltered(selectedLevel === 'Tümü' ? articles : articles.filter(a => a.cefr_level === selectedLevel))
  }, [selectedLevel, articles])

  async function loadArticles() {
    try { const data = await getArticles(); setArticles(data.articles || []) } catch {}
    finally { setLoading(false) }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MAKALELER</Text>
        <Text style={styles.title}>Keşfet</Text>
      </View>

      <FlatList
        data={cefrLevels}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
        keyExtractor={i => i}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterBtn, selectedLevel === item && styles.filterBtnActive, selectedLevel === item && item !== 'Tümü' && { backgroundColor: cefrColors[item], borderColor: cefrColors[item] }]}
            onPress={() => setSelectedLevel(item)}
          >
            <Text style={[styles.filterText, selectedLevel === item && { color: item === 'Tümü' ? colors.bg : '#000' }]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshing={loading}
          onRefresh={loadArticles}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>İçerik bulunamadı</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: '/(tabs)/oku', params: { prefillUrl: item.url } })}
              activeOpacity={0.82}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                  <Ionicons name="newspaper-outline" size={28} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.cardContent}>
                <View style={styles.cardMeta}>
                  <View style={[styles.cefrBadge, { borderColor: cefrColors[item.cefr_level] || colors.border, backgroundColor: (cefrColors[item.cefr_level] || '#fff') + '15' }]}>
                    <Text style={[styles.cefrText, { color: cefrColors[item.cefr_level] || colors.textMuted }]}>{item.cefr_level}</Text>
                  </View>
                  <Text style={styles.source}>{item.source}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                <View style={styles.readLink}>
                  <Text style={styles.readLinkText}>Okumaya başla</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.accent} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterList: { maxHeight: 40, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  empty: { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  card: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardImage: { width: '100%', height: 140, backgroundColor: colors.bgSurface },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardContent: { padding: 14 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  cefrText: { fontSize: 10, fontWeight: '800' },
  source: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 22, marginBottom: 6 },
  cardDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  readLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readLinkText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
})
