import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { deleteReadingHistoryItem, listReadingHistory, ReadingHistoryItem } from '../../lib/data'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { timeAgoTr } from '../../lib/time'
import { useRouter } from 'expo-router'

export default function HistoryScreen() {
  const [history, setHistory] = useState<ReadingHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    setHistory(await listReadingHistory())
    setLoading(false)
  }

  async function deleteItem(id: string) {
    await deleteReadingHistoryItem(id)
    setHistory(p => p.filter(h => h.id !== id))
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>GEÇMİŞ</Text>
        <Text style={styles.title}>Okuma Geçmişi</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : history.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="book-outline" size={32} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>Henüz okuma yok</Text>
          <Text style={styles.emptyText}>Makale okudukça buraya kaydedilir</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: '/(tabs)/oku', params: item.url ? { prefillUrl: item.url } : {} })}
              activeOpacity={0.82}
            >
              <View style={styles.cardLeft}>
                <View style={styles.cardIcon}>
                  <Ionicons name="book-outline" size={16} color={colors.accent} />
                </View>
                <View style={styles.connector} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title || item.url || 'Manuel metin'}</Text>
                <View style={styles.meta}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{timeAgoTr(item.created_at)}</Text>
                  {item.word_count ? (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <Ionicons name="text-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.metaText}>{item.word_count} kelime</Text>
                    </>
                  ) : null}
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.openBtn} onPress={() => router.push({ pathname: '/(tabs)/oku', params: item.url ? { prefillUrl: item.url } : {} })}>
                    <Text style={styles.openBtnText}>Devam Et</Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="trash-outline" size={15} color="#f87171" />
                  </TouchableOpacity>
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
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 14 },

  card: { flexDirection: 'row', gap: 12 },
  cardLeft: { alignItems: 'center', width: 36 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(250,204,21,0.2)' },
  connector: { width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  cardBody: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 21, marginBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  metaText: { color: colors.textMuted, fontSize: 12 },
  metaDot: { color: colors.textMuted, fontSize: 12 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  openBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  deleteBtn: { padding: 4 },
})
