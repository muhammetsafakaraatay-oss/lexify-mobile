import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'expo-router'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ total: 0, mastered: 0, today: 0, week: 0, streak: 0 })
  const [cefrDist, setCefrDist] = useState<Record<string, number>>({})
  const [recentWords, setRecentWords] = useState<any[]>([])
  const [recentHistory, setRecentHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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

    let streak = 0
    const sortedDates = [...new Set(words.map((w: any) => w.created_at.split('T')[0]))].sort().reverse()
    let checkDate = new Date().toISOString().split('T')[0]
    for (const date of sortedDates) {
      if (date === checkDate) {
        streak++
        const d = new Date(checkDate)
        d.setDate(d.getDate() - 1)
        checkDate = d.toISOString().split('T')[0]
      } else break
    }

    setStats({
      total: words.length,
      mastered: words.filter((w: any) => w.stage === 'mastered').length,
      today: todayRes.count || 0,
      week: weekRes.count || 0,
      streak,
    })
    setCefrDist(dist)
    setRecentWords(
      words
        .filter((w: any) => w.stage !== 'mastered')
        .sort((a: any, b: any) => (a.repetitions ?? 0) - (b.repetitions ?? 0))
        .slice(0, 3)
    )
    setRecentHistory(historyRes.data || [])
    setLoading(false)
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor(diff / 60000)
    if (days > 0) return `${days} gün önce`
    if (hours > 0) return `${hours} saat önce`
    if (mins > 1) return `${mins} dakika önce`
    return 'Az önce'
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  const name = user?.user_metadata?.full_name || 'Kullanıcı'
  const avatar = user?.user_metadata?.avatar_url
  const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const maxCefr = Math.max(...Object.values(cefrDist), 1)
  const masteryPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.profileCard}>
          {avatar
            ? <Image source={{ uri: avatar }} style={styles.avatar} />
            : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
              </View>
            )
          }
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{user?.email}</Text>

          {stats.streak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakText}>{stats.streak} günlük seri</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Toplam', value: stats.total, color: colors.accent },
            { label: 'Bugün', value: stats.today, color: '#4ade80' },
            { label: 'Bu Hafta', value: stats.week, color: '#60a5fa' },
            { label: 'Öğrenildi', value: stats.mastered, color: '#e879f9' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {stats.total > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Öğrenme Durumu</Text>
              <Text style={styles.sectionBadge}>{masteryPct}% öğrenildi</Text>
            </View>
            <View style={styles.masteryBar}>
              <View style={[styles.masteryFill, { width: `${masteryPct}%` }]} />
            </View>
            <Text style={styles.masteryHint}>{stats.mastered} / {stats.total} kelime öğrenildi</Text>
          </View>
        )}

        {recentWords.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔁 Tekrar Edilecekler</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/flashcards')}>
                <Text style={styles.sectionLink}>Flashcard →</Text>
              </TouchableOpacity>
            </View>
            {recentWords.map((w: any) => (
              <View key={w.id} style={styles.wordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.wordText}>{w.word}</Text>
                  {w.ipa ? <Text style={styles.wordIpa}>/{w.ipa}/</Text> : null}
                </View>
                <Text style={styles.wordTr}>{w.translation}</Text>
              </View>
            ))}
          </View>
        )}

        {recentHistory.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📖 Son Okunanlar</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.sectionLink}>Tümü →</Text>
              </TouchableOpacity>
            </View>
            {recentHistory.map((h: any) => (
              <TouchableOpacity
                key={h.id}
                style={styles.historyRow}
                onPress={() => router.push({ pathname: '/(tabs)/oku', params: h.url ? { prefillUrl: h.url } : {} })}
              >
                <Ionicons name="book-outline" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
                <Text style={styles.historyTitle} numberOfLines={1}>{h.title || h.url || 'Manuel metin'}</Text>
                <Text style={styles.historyTime}>{timeAgo(h.created_at)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {Object.keys(cefrDist).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 CEFR Dağılımı</Text>
            {cefrOrder.filter(l => cefrDist[l]).map(level => (
              <View key={level} style={styles.cefrRow}>
                <Text style={[styles.cefrLabel, { color: cefrColors[level] }]}>{level}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: ((cefrDist[level] / maxCefr) * 100) + '%' as any, backgroundColor: cefrColors[level] }]} />
                </View>
                <Text style={styles.cefrCount}>{cefrDist[level]}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Hızlı Erişim</Text>
          {[
            { icon: 'folder-outline', label: 'Listelerim', route: '/(tabs)/collections' },
            { icon: 'time-outline', label: 'Okuma Geçmişi', route: '/(tabs)/history' },
            { icon: 'search-outline', label: 'Kelime Ara', route: '/(tabs)/search' },
            { icon: 'card-outline', label: 'Flashcard', route: '/(tabs)/flashcards' },
            { icon: 'game-controller-outline', label: 'Quiz', route: '/(tabs)/quiz' },
          ].map(({ icon, label, route }) => (
            <TouchableOpacity key={label} style={styles.settingRow} onPress={() => router.push(route as any)}>
              <View style={styles.settingLeft}>
                <Ionicons name={icon as any} size={18} color={colors.textMuted} />
                <Text style={styles.settingText}>{label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
          <Ionicons name="log-out-outline" size={20} color="#f87171" />
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  profileCard: { alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12, borderWidth: 2, borderColor: colors.border },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.bg },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 3 },
  email: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(251,146,60,0.12)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.3)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  streakEmoji: { fontSize: 16 },
  streakText: { color: '#fb923c', fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  section: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  sectionBadge: { fontSize: 12, color: colors.accent, fontWeight: '700' },
  sectionLink: { fontSize: 12, color: colors.accent, fontWeight: '700' },
  masteryBar: { height: 8, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  masteryFill: { height: '100%', backgroundColor: '#e879f9', borderRadius: 4 },
  masteryHint: { color: colors.textMuted, fontSize: 12 },
  wordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  wordText: { fontSize: 15, fontWeight: '600', color: colors.text },
  wordIpa: { fontSize: 11, color: colors.textMuted, fontFamily: 'Courier', marginTop: 2 },
  wordTr: { fontSize: 14, color: colors.textMuted },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyTitle: { flex: 1, fontSize: 14, color: colors.text },
  historyTime: { fontSize: 11, color: colors.textMuted },
  cefrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cefrLabel: { width: 28, fontSize: 12, fontWeight: '700' },
  barBg: { flex: 1, height: 6, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  cefrCount: { width: 24, fontSize: 11, color: colors.textMuted, textAlign: 'right' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { color: colors.text, fontSize: 15 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)', borderRadius: 14, padding: 14, justifyContent: 'center', marginTop: 4, backgroundColor: 'rgba(248,113,113,0.05)' },
  signOutText: { color: '#f87171', fontWeight: '600', fontSize: 15 },
})
