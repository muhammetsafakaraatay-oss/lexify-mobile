import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getCurrentUser, signOut, ReplitUser } from '../../lib/auth'
import { useRouter } from 'expo-router'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { useSubscription } from '../../lib/revenuecat'

export default function ProfileScreen() {
  const { isSubscribed } = useSubscription()
  const [user, setUser] = useState<ReplitUser | null>(null)
  const [stats, setStats] = useState({ total: 0, mastered: 0, today: 0, week: 0, streak: 0 })
  const [cefrDist, setCefrDist] = useState<Record<string, number>>({})
  const [recentWords, setRecentWords] = useState<any[]>([])
  const [recentHistory, setRecentHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const user = await getCurrentUser()
    if (!user) { setLoading(false); return }
    setUser(user)
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) throw new Error('profile fetch failed')
      const data = await res.json()
      setStats(data.stats)
      setCefrDist(data.cefrDist)
      setRecentWords(
        (data.words || [])
          .filter((w: any) => w.stage !== 'mastered')
          .sort((a: any, b: any) => (a.repetitions ?? 0) - (b.repetitions ?? 0))
          .slice(0, 3)
      )
      setRecentHistory(data.recentHistory || [])
    } catch (e) {
      console.warn('profile load error:', e)
    }
    setLoading(false)
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000); const hours = Math.floor(diff / 3600000); const mins = Math.floor(diff / 60000)
    if (days > 0) return `${days} gün önce`; if (hours > 0) return `${hours} saat önce`; if (mins > 1) return `${mins} dk önce`; return 'Az önce'
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  const name = user?.name || 'Kullanıcı'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const avatar = user?.avatar_url
  const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const maxCefr = Math.max(...Object.values(cefrDist), 1)
  const masteryPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {avatar
              ? <Image source={{ uri: avatar }} style={styles.avatar} />
              : <Text style={styles.avatarText}>{initials}</Text>
            }
          </View>
          <Text style={styles.name}>{name}</Text>
          {stats.streak > 0 && (
            <View style={styles.streakBadge}>
              <Text>🔥</Text>
              <Text style={styles.streakText}>{stats.streak} günlük seri</Text>
            </View>
          )}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Toplam', value: stats.total, color: colors.accent },
            { label: 'Öğrenildi', value: stats.mastered, color: '#4ade80' },
            { label: 'Bugün', value: stats.today, color: '#60a5fa' },
            { label: 'Bu Hafta', value: stats.week, color: '#fb923c' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Mastery */}
        {stats.total > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Öğrenme Durumu</Text>
              <Text style={[styles.cardBadge, { color: '#e879f9' }]}>{masteryPct}%</Text>
            </View>
            <View style={styles.masteryTrack}>
              <View style={[styles.masteryFill, { width: `${masteryPct}%` as any }]} />
            </View>
            <Text style={styles.masterySub}>{stats.mastered} / {stats.total} kelime öğrenildi</Text>
          </View>
        )}

        {/* Words to review */}
        {recentWords.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🔁 Tekrar Edilecekler</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/flashcards')}>
                <Text style={styles.cardLink}>Flashcard →</Text>
              </TouchableOpacity>
            </View>
            {recentWords.map((w: any, i: number) => (
              <View key={w.id} style={[styles.wordRow, i < recentWords.length - 1 && styles.wordRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.wordText}>{w.word}</Text>
                  {w.ipa ? <Text style={styles.wordIpa}>/{w.ipa}/</Text> : null}
                </View>
                <Text style={styles.wordTr}>{w.translation}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Reading history */}
        {recentHistory.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📖 Son Okunanlar</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.cardLink}>Tümü →</Text>
              </TouchableOpacity>
            </View>
            {recentHistory.map((h: any, i: number) => (
              <TouchableOpacity
                key={h.id}
                style={[styles.historyRow, i < recentHistory.length - 1 && styles.wordRowBorder]}
                onPress={() => router.push({ pathname: '/(tabs)/oku', params: h.url ? { prefillUrl: h.url } : {} })}
              >
                <Ionicons name="book-outline" size={14} color={colors.textMuted} />
                <Text style={styles.historyTitle} numberOfLines={1}>{h.title || h.url || 'Manuel metin'}</Text>
                <Text style={styles.historyTime}>{timeAgo(h.created_at)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* CEFR distribution */}
        {Object.keys(cefrDist).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 CEFR Dağılımı</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
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
          </View>
        )}

        {/* Quick links */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚙️ Hızlı Erişim</Text>
          <View style={{ marginTop: 4 }}>
            {[
              { icon: 'folder-outline', label: 'Listelerim', route: '/(tabs)/collections' },
              { icon: 'time-outline', label: 'Okuma Geçmişi', route: '/(tabs)/history' },
              { icon: 'search-outline', label: 'Kelime Ara', route: '/(tabs)/search' },
              { icon: 'card-outline', label: 'Flashcard', route: '/(tabs)/flashcards' },
              { icon: 'game-controller-outline', label: 'Quiz', route: '/(tabs)/quiz' },
            ].map(({ icon, label, route }, i, arr) => (
              <TouchableOpacity key={label} style={[styles.linkRow, i < arr.length - 1 && styles.wordRowBorder]} onPress={() => router.push(route as any)}>
                <View style={styles.linkLeft}>
                  <Ionicons name={icon as any} size={17} color={colors.textMuted} />
                  <Text style={styles.linkText}>{label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Premium banner */}
        {!isSubscribed && (
          <TouchableOpacity style={styles.premiumBanner} onPress={() => router.push('/paywall')} activeOpacity={0.85}>
            <View style={styles.premiumLeft}>
              <Text style={styles.premiumEmoji}>✦</Text>
              <View>
                <Text style={styles.premiumTitle}>Premium'a Geç</Text>
                <Text style={styles.premiumSub}>Sınırsız kelime, OCR, YouTube ve daha fazlası</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.accent} />
          </TouchableOpacity>
        )}

        {isSubscribed && (
          <View style={styles.premiumActiveBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
            <Text style={styles.premiumActiveText}>Premium aktif ✦</Text>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()}>
          <Ionicons name="log-out-outline" size={18} color="#f87171" />
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  hero: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontSize: 30, fontWeight: '900', color: colors.bg },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(251,146,60,0.12)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.3)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  streakText: { color: '#fb923c', fontWeight: '700', fontSize: 13 },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 3, fontWeight: '600' },
  card: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardBadge: { fontSize: 13, fontWeight: '800' },
  cardLink: { fontSize: 12, color: colors.accent, fontWeight: '700' },
  masteryTrack: { height: 7, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  masteryFill: { height: '100%', backgroundColor: '#e879f9', borderRadius: 4 },
  masterySub: { color: colors.textMuted, fontSize: 12 },
  wordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  wordRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  wordText: { fontSize: 15, fontWeight: '600', color: colors.text },
  wordIpa: { fontSize: 11, color: colors.textMuted, fontFamily: 'Courier', marginTop: 1 },
  wordTr: { fontSize: 13, color: colors.textMuted },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  historyTitle: { flex: 1, fontSize: 14, color: colors.text },
  historyTime: { fontSize: 11, color: colors.textMuted },
  cefrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cefrLabel: { width: 28, fontSize: 12, fontWeight: '800' },
  barBg: { flex: 1, height: 6, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  cefrCount: { width: 24, fontSize: 11, color: colors.textMuted, textAlign: 'right' },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkText: { color: colors.text, fontSize: 15 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 14, padding: 14, marginTop: 4, backgroundColor: 'rgba(248,113,113,0.05)' },
  signOutText: { color: '#f87171', fontWeight: '600', fontSize: 15 },
  premiumBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.accentDim, borderWidth: 1, borderColor: 'rgba(250,204,21,0.35)', borderRadius: 16, padding: 16, marginBottom: 12 },
  premiumLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  premiumEmoji: { fontSize: 20, color: colors.accent, fontWeight: '900' },
  premiumTitle: { fontSize: 15, fontWeight: '800', color: colors.accent },
  premiumSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  premiumActiveBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: 'rgba(250,204,21,0.3)', borderRadius: 14, padding: 14, marginBottom: 12 },
  premiumActiveText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
})
