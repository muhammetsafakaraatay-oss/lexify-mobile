import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  SafeAreaView, ActivityIndicator, TouchableOpacity
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

export default function HistoryScreen() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('reading_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setHistory(data || [])
    setLoading(false)
  }

  async function deleteItem(id: string) {
    await supabase.from('reading_history').delete().eq('id', id)
    setHistory(p => p.filter(h => h.id !== id))
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor(diff / 60000)
    if (days > 0) return days + ' gun once'
    if (hours > 0) return hours + ' saat once'
    return mins + ' dk once'
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Okuma Gecmisi</Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      ) : history.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="book-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Henuz okuma gecmisiniz yok</Text>
          <Text style={styles.emptySubText}>Makale okudukca buraya kaydedilir</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardMain}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title || item.url || 'Manuel metin'}
                  </Text>
                  <View style={styles.meta}>
                    <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.metaText}>{timeAgo(item.created_at)}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color="#f87171" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, padding: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 12 },
  emptySubText: { color: colors.textMuted, fontSize: 14 },
  card: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textMuted, fontSize: 12 },
  deleteBtn: { padding: 4 },
})
