import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ total: 0, mastered: 0, today: 0, week: 0 })
  const [cefrDist, setCefrDist] = useState<Record<string, number>>({})
  const [recentWords, setRecentWords] = useState<any[]>([])
  const [recentHistory, setRecentHistory] = useState<any[]>([])
  const [wordOfDay, setWordOfDay] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const cefrColor: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUser(user)

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [all, todayRes, weekRes, historyRes] = await Promise.all([
      supabase.from('saved_words').select('*').eq('user_id', user.id),
      supabase.from('saved_words').select('id', { count: 'exact' }).eq('user_id', user.id).gte('created_at', today),
      supabase.from('saved_words').select('id', { count: 'exact' }).eq('user_id', user.id).gte('created_at', weekAgo),
      supabase.from('reading_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
    ])

    const words = all.data || []
    const dist: Record<string, number> = {}
    words.forEach((w: any) => { if (w.cefr) dist[w.cefr] = (dist[w.cefr] || 0) + 1 })

    setStats({
      total: words.length,
      mastered: words.filter((w: any) => w.mastered).length,
      today: todayRes.count || 0,
      week: weekRes.count || 0,
    })
    setCefrDist(dist)
    setRecentWords(words.filter((w: any) => !w.mastered).sort((a: any, b: any) => a.review_count - b.review_count).slice(0, 3))
    setRecentHistory(historyRes.data || [])

    try {
      const res = await fetch('https://lexitr.vercel.app/api/word-of-day')
      setWordOfDay(await res.json())
    } catch (e) {}

    setLoading(false)
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor(diff / 3600000)
    if (days > 0) return days + ' gun once'
    if (hours > 0) return hours + ' saat once'
    return 'Az once'
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  const name = user?.user_metadata?.full_name || 'Kullanici'
  const avatar = user?.user_metadata?.avatar_url
  const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const maxCefr = Math.max(...Object.values(cefrDist), 1)

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.profileCard}>
          {avatar
            ? <Image source={{ uri: avatar }} style={styles.avatar} />
            : <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{name[0]}</Text></View>
          }
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Toplam', value: stats.total, color: colors.accent },
            { label: 'Bugun', value: stats.today, color: '#4ade80' },
            { label: 'Bu Hafta', value: stats.week, color: '#60a5fa' },
            { label: 'Ogrenildi', value: stats.mastered, color: '#e879f9' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {wordOfDay && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Gunun Kelimesi</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={styles.wodWord}>{wordOfDay.word}</Text>
              {wordOfDay.cefr && (
                <View style={[styles.cefrBadge, { borderColor: cefrColor[wordOfDay.cefr] || colors.border }]}>
                  <Text style={[styles.cefrText, { color: cefrColor[wordOfDay.cefr] || colors.textMuted }]}>{wordOfDay.cefr}</Text>
                </View>
              )}
            </View>
            <Text style={styles.wodTr}>{wordOfDay.translation}</Text>
          </View>
        )}

        {recentWords.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔥 Tekrar Et</Text>
            {recentWords.map((w: any) => (
              <View key={w.id} style={styles.wordRow}>
                <Text style={styles.wordText}>{w.word}</Text>
                <Text style={styles.wordTr}>{w.translation}</Text>
              </View>
            ))}
          </View>
        )}

        {recentHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📖 Son Okunanlar</Text>
            {recentHistory.map((h: any) => (
              <View key={h.id} style={styles.historyRow}>
                <Text style={styles.historyTitle} numberOfLines={1}>{h.title || h.url || 'Manuel metin'}</Text>
                <Text style={styles.historyTime}>{timeAgo(h.created_at)}</Text>
              </View>
            ))}
          </View>
        )}

        {Object.keys(cefrDist).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 CEFR Dagilimi</Text>
            {cefrOrder.filter(l => cefrDist[l]).map(level => (
              <View key={level} style={styles.cefrRow}>
                <Text style={[styles.cefrLabel, { color: cefrColor[level] }]}>{level}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: ((cefrDist[level] / maxCefr) * 100) + '%' as any, backgroundColor: cefrColor[level] }]} />
                </View>
                <Text style={styles.cefrCount}>{cefrDist[level]}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
          <Ionicons name="log-out-outline" size={20} color="#f87171" />
          <Text style={styles.signOutText}>Cikis Yap</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 20 },
  profileCard: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 10 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 28, fontWeight: '800', color: colors.bg },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 2 },
  email: { fontSize: 13, color: colors.textMuted },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  section: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  wodWord: { fontSize: 20, fontWeight: '800', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  wodTr: { color: colors.textMuted, fontSize: 13 },
  wordRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  wordText: { fontSize: 15, fontWeight: '600', color: colors.text },
  wordTr: { fontSize: 14, color: colors.textMuted },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyTitle: { flex: 1, fontSize: 14, color: colors.text, marginRight: 8 },
  historyTime: { fontSize: 12, color: colors.textMuted },
  cefrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cefrLabel: { width: 28, fontSize: 12, fontWeight: '700' },
  barBg: { flex: 1, height: 6, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  cefrCount: { width: 20, fontSize: 11, color: colors.textMuted, textAlign: 'right' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#f87171', borderRadius: 12, padding: 14, justifyContent: 'center', marginTop: 4 },
  signOutText: { color: '#f87171', fontWeight: '600', fontSize: 15 },
})
