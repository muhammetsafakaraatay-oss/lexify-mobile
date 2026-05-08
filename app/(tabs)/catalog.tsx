import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { getArticles } from '../../lib/api'
import { cefrColors, cefrLevels } from '../../lib/cefr'
import { colors } from '../../lib/theme'

interface Article {
  id: string
  title: string
  url: string
  source: string
  cefr_level: string
  description: string
  image_url: string
}

export default function CatalogScreen() {
  const [articles, setArticles] = useState<Article[]>([])
  const [filtered, setFiltered] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState('Tümü')
  const router = useRouter()

  useEffect(() => { loadArticles() }, [])

  useEffect(() => {
    if (selectedLevel === 'Tümü') setFiltered(articles)
    else setFiltered(articles.filter(a => a.cefr_level === selectedLevel))
  }, [selectedLevel, articles])

  async function loadArticles() {
    try {
      const data = await getArticles()
      setArticles(data.articles || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function handleArticle(article: Article) {
    router.push({ pathname: '/(tabs)/oku', params: { prefillUrl: article.url } })
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Keşfet</Text>

      <FlatList
        data={cefrLevels}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        keyExtractor={i => i}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterBtn, selectedLevel === item && styles.filterBtnActive]}
            onPress={() => setSelectedLevel(item)}
          >
            <Text style={[styles.filterText, selectedLevel === item && { color: colors.bg }]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshing={loading}
          onRefresh={loadArticles}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => handleArticle(item)}>
              <View style={styles.cardContent}>
                <View style={styles.cardMeta}>
                  <View style={[styles.cefrBadge, { borderColor: cefrColors[item.cefr_level] || colors.border }]}>
                    <Text style={[styles.cefrText, { color: cefrColors[item.cefr_level] || colors.textMuted }]}>{item.cefr_level}</Text>
                  </View>
                  <Text style={styles.source}>{item.source}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
              </View>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} />
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, padding: 20, paddingBottom: 12 },
  filterList: { maxHeight: 44, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 12 },
  cardContent: { flex: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  source: { color: colors.textMuted, fontSize: 11 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4, lineHeight: 21 },
  cardDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  cardImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: colors.bgSurface },
})
