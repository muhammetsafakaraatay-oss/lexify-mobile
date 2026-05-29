import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  SafeAreaView, ActivityIndicator, TouchableOpacity, Pressable,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { deleteReadingHistoryItem, listReadingHistory, ReadingHistoryItem } from '../../lib/data'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { timeAgoTr } from '../../lib/time'
import { isGuestMode } from '../../lib/guest'

export default function HistoryScreen() {
  const [history, setHistory] = useState<ReadingHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [guest, setGuest] = useState(false)
  const router = useRouter()

  const load = useCallback(async () => {
    setGuest(await isGuestMode())
    setHistory(await listReadingHistory())
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function deleteItem(id: string) {
    await deleteReadingHistoryItem(id)
    setHistory((p) => p.filter((h) => h.id !== id))
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Okuma Geçmişi</Text>
      {guest ? (
        <Text style={styles.guestHint}>
          Misafir modunda geçmiş bu cihazda saklanır. Giriş yapınca buluta aktarılır.
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      ) : history.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="book-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Henüz okuma geçmişin yok</Text>
          <Text style={styles.emptySubText}>Makale veya metin okudukça buraya kaydedilir</Text>
          <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(tabs)/catalog')}>
            <Text style={styles.emptyCtaText}>Makale Keşfet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                style={styles.cardPress}
                onPress={() => router.push({ pathname: '/(tabs)/oku', params: item.url ? { prefillUrl: item.url } : {} })}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="book-outline" size={16} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title || item.url || 'Manuel metin'}
                  </Text>
                  <View style={styles.meta}>
                    <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.metaText}>{timeAgoTr(item.created_at)}</Text>
                    {item.word_count ? (
                      <>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaText}>{item.word_count} kelime</Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
              </Pressable>
              <TouchableOpacity
                onPress={() => deleteItem(item.id)}
                style={styles.deleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color="#f87171" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, padding: 20, paddingBottom: 8 },
  guestHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 12 },
  emptySubText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  emptyCta: {
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyCtaText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textMuted, fontSize: 12 },
  metaDot: { color: colors.textMuted, fontSize: 12 },
  deleteBtn: { paddingHorizontal: 14, paddingVertical: 14 },
})
