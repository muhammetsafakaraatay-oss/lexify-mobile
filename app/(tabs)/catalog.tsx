import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
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

const cefrColor: Record<string, string> = {
  A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
}

const levels = ['Tümü', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function CatalogScreen() {
  const [articles, setArticles] = useState<Article[]>([])
  const [filtered, setFiltered] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState('Tümü')
  const router = useRouter()

  useEffect(() => { loadArticles() }, [])

  useEffect(() => {
    if (selectedLevel === 'Tümü') setFiltered(articles)
    else setFiltered(articles.filter(a => a.cefr_level === selectedLevel))
  }, [selectedLevel, articles])

  async function loadArticles() {
    setFetchError(false)
    setLoading(true)
    try {
      const res = await fetch('https://lexitr.vercel.app/api/articles')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setArticles(data.articles || [])
    } catch (e) {
      console.warn('[catalog] loadArticles failed:', e)
      setFetchError(true)
    }
    finally { setLoading(false) }
  }

  function handleArticle(article: Article) {
    router.push({ pathname: '/(tabs)/oku', params: { prefillUrl: article.url } })
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Keşfet</Text>

      <FlatList
        data={levels}
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
      ) : fetchError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>İçerikler yüklenemedi</Text>
          <Text style={styles.emptyDesc}>İnternet bağlantını kontrol et ve tekrar dene.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadArticles}>
            <Text style={styles.retryText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>Bu seviyede makale yok</Text>
          <Text style={styles.emptyDesc}>Farklı bir seviye seçmeyi dene.</Text>
        </View>
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
                  <View style={[styles.cefrBadge, { borderColor: cefrColor[item.cefr_level] || colors.border }]}>
                    <Text style={[styles.cefrText, { color: cefrColor[item.cefr_level] || colors.textMuted }]}>{item.cefr_level}</Text>
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
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn: { backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
})
