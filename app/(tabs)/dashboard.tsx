import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native'
import { supabase } from '../../lib/supabase'
import { getWordOfDay, WordOfDayPayload } from '../../lib/api'
import { getDueCount, ReadingHistoryItem } from '../../lib/data'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

interface Stats {
  total: number
  today: number
  week: number
  mastered: number
  streak: number
}

const PRIMARY = [
  { label: 'Oku', icon: 'book-outline' as const, route: '/(tabs)/oku', color: '#facc15' },
  { label: 'Keşfet', icon: 'compass-outline' as const, route: '/(tabs)/catalog', color: '#60a5fa' },
  { label: 'Kamera', icon: 'camera-outline' as const, route: '/(tabs)/camera', color: '#4ade80' },
  { label: 'Video', icon: 'play-circle-outline' as const, route: '/(tabs)/video', color: '#e879f9' },
]

const QUICK = [
  { label: 'Flashcard', icon: 'layers-outline' as const, route: '/(tabs)/flashcards' },
  { label: 'Quiz', icon: 'game-controller-outline' as const, route: '/(tabs)/quiz' },
  { label: 'Kelime Ara', icon: 'search-outline' as const, route: '/(tabs)/search' },
  { label: 'Listeler', icon: 'folder-outline' as const, route: '/(tabs)/collections' },
]

export default function DashboardScreen() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, week: 0, mastered: 0, streak: 0 })
  const [dueCount, setDueCount] = useState({ due: 0, newWords: 0, learning: 0 })
  const [wordOfDay, setWordOfDay] = useState<WordOfDayPayload | null>(null)
  const [recentHistory, setRecentHistory] = useState<ReadingHistoryItem[]>([])
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [totalRes, masteredRes, todayRes, weekRes, historyRes, allWordsRes, due] = await Promise.all([
      supabase.from('saved_words').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('saved_words').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('stage', 'mastered'),
      supabase.from('saved_words').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', today),
      supabase.from('saved_words').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekAgo),
      supabase.from('reading_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
      supabase.from('saved_words').select('created_at').eq('user_id', user.id),
      getDueCount(),
    ])

    const words = allWordsRes.data || []
    let streak = 0
    const sortedDates = [...new Set(words.map((w: any) => w.created_at.split('T')[0]))].sort().reverse()
    let checkDate = new Date().toISOString().split('T')[0]
    for (const date of sortedDates) {
      if (date === checkDate) {
        streak++
        const d = new Date(checkDate); d.setDate(d.getDate() - 1)
        checkDate = d.toISOString().split('T')[0]
      } else break
    }

    setStats({ total: totalRes.count ?? 0, mastered: masteredRes.count ?? 0, today: todayRes.count ?? 0, week: weekRes.count ?? 0, streak })
    setDueCount(due)
    setRecentHistory((historyRes.data ?? []) as ReadingHistoryItem[])
    try { setWordOfDay(await getWordOfDay()) } catch {}
  }

  const name = user?.user_metadata?.full_name?.split(' ')[0] || 'Kullanıcı'
  const initials = (user?.user_metadata?.full_name || 'K').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const masteryPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0
  const hasDue = dueCount.due > 0 || dueCount.newWords > 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEye}>LEXIFY</Text>
          <Text style={styles.headerGreet}>Merhaba, {name}</Text>
        </View>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{initials}</Text>
          {stats.streak > 0 && (
            <View style={styles.streakDot}>
              <Text style={styles.streakDotText}>🔥</Text>
            </View>
          )}
        </View>
      </View>

      {/* Streak bar */}
      {stats.streak > 0 && (
        <View style={styles.streakBar}>
          <Text style={styles.streakFire}>🔥</Text>
          <Text style={styles.streakText}>{stats.streak} günlük seri devam ediyor — bugün de çalış!</Text>
        </View>
      )}

      {/* SRS due card */}
      {hasDue ? (
        <TouchableOpacity style={styles.dueCard} onPress={() => router.push('/(tabs)/flashcards')} activeOpacity={0.88}>
          <View style={styles.dueTop}>
            <View>
              <Text style={styles.dueEye}>BUGÜN TEKRAR ET</Text>
              <Text style={styles.dueTitle}>SM-2 Tekrar Zamanı</Text>
            </View>
            <View style={styles.dueArrow}>
              <Ionicons name="arrow-forward" size={18} color={colors.bg} />
            </View>
          </View>
          <View style={styles.duePills}>
            <View style={styles.duePill}>
              <Text style={styles.duePillNum}>{dueCount.due}</Text>
              <Text style={styles.duePillLabel}>bekleyen</Text>
            </View>
            <View style={styles.dueDivider} />
            <View style={styles.duePill}>
              <Text style={styles.duePillNum}>{dueCount.newWords}</Text>
              <Text style={styles.duePillLabel}>yeni</Text>
            </View>
            <View style={styles.dueDivider} />
            <View style={styles.duePill}>
              <Text style={styles.duePillNum}>{dueCount.learning}</Text>
              <Text style={styles.duePillLabel}>öğreniliyor</Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.allDoneCard}>
          <Text style={styles.allDoneEmoji}>✅</Text>
          <View>
            <Text style={styles.allDoneTitle}>Bugün tamamlandı!</Text>
            <Text style={styles.allDoneSub}>Tekrar edilecek kart yok. Yarın görüşürüz.</Text>
          </View>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: colors.accent }]}>{stats.total}</Text>
          <Text style={styles.statLabel}>Toplam</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: '#4ade80' }]}>{stats.mastered}</Text>
          <Text style={styles.statLabel}>Öğrenildi</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: '#60a5fa' }]}>{stats.today}</Text>
          <Text style={styles.statLabel}>Bugün</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: '#fb923c' }]}>{stats.week}</Text>
          <Text style={styles.statLabel}>Bu Hafta</Text>
        </View>
      </View>

      {/* Mastery progress */}
      {stats.total > 0 && (
        <View style={styles.masteryCard}>
          <View style={styles.masteryRow}>
            <Text style={styles.masteryLabel}>Öğrenme İlerlemen</Text>
            <Text style={styles.masteryPct}>{masteryPct}%</Text>
          </View>
          <View style={styles.masteryTrack}>
            <View style={[styles.masteryFill, { width: `${masteryPct}%` as any }]} />
          </View>
          <Text style={styles.masterySub}>{stats.mastered} / {stats.total} kelime öğrenildi</Text>
        </View>
      )}

      {/* Primary actions */}
      <Text style={styles.sectionTitle}>Nerede başlamak istiyorsun?</Text>
      <View style={styles.primaryGrid}>
        {PRIMARY.map((a) => (
          <TouchableOpacity key={a.label} style={styles.primaryCard} onPress={() => router.push(a.route as any)} activeOpacity={0.82}>
            <View style={[styles.primaryIcon, { backgroundColor: a.color + '18' }]}>
              <Ionicons name={a.icon} size={22} color={a.color} />
            </View>
            <Text style={styles.primaryLabel}>{a.label}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick access */}
      <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
      <View style={styles.quickGrid}>
        {QUICK.map((a) => (
          <TouchableOpacity key={a.label} style={styles.quickBtn} onPress={() => router.push(a.route as any)} activeOpacity={0.8}>
            <Ionicons name={a.icon} size={16} color={colors.accent} />
            <Text style={styles.quickLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Word of day */}
      {wordOfDay && (
        <View style={styles.wodCard}>
          <Text style={styles.wodEye}>⚡ GÜNÜN KELİMESİ</Text>
          <View style={styles.wodRow}>
            <Text style={styles.wodWord}>{wordOfDay.word}</Text>
            {wordOfDay.cefr && (
              <View style={[styles.cefrBadge, { borderColor: cefrColors[wordOfDay.cefr] || colors.border }]}>
                <Text style={[styles.cefrText, { color: cefrColors[wordOfDay.cefr] || colors.textMuted }]}>{wordOfDay.cefr}</Text>
              </View>
            )}
          </View>
          <Text style={styles.wodTr}>{wordOfDay.translation}</Text>
        </View>
      )}

      {/* Recent history */}
      {recentHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kaldığın Yerden Devam Et</Text>
          {recentHistory.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.historyCard}
              onPress={() => router.push({ pathname: '/(tabs)/oku', params: item.url ? { prefillUrl: item.url } : {} })}
              activeOpacity={0.8}
            >
              <View style={styles.historyIcon}>
                <Ionicons name="book-outline" size={14} color={colors.accent} />
              </View>
              <Text style={styles.historyTitle} numberOfLines={1}>{item.title || item.url || 'Manuel metin'}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Empty state */}
      {stats.total === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>İlk adımı at 🚀</Text>
          <Text style={styles.emptySub}>Bir makale oku, kelimelere dokun ve kaydet. Sonra flashcard ile tekrar et.</Text>
          <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(tabs)/catalog')}>
            <Text style={styles.emptyCtaText}>Makale Keşfet →</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerEye: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  headerGreet: { fontSize: 22, fontWeight: '800', color: colors.text },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: colors.bg },
  streakDot: { position: 'absolute', top: -4, right: -4, backgroundColor: colors.bg, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  streakDotText: { fontSize: 12 },

  streakBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 14, backgroundColor: 'rgba(251,146,60,0.1)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.25)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  streakFire: { fontSize: 18 },
  streakText: { color: '#fb923c', fontSize: 13, fontWeight: '600', flex: 1 },

  dueCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.accent, borderRadius: 20, padding: 18 },
  dueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  dueEye: { color: 'rgba(0,0,0,0.5)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  dueTitle: { color: colors.bg, fontSize: 18, fontWeight: '800' },
  dueArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  duePills: { flexDirection: 'row', alignItems: 'center' },
  duePill: { flex: 1, alignItems: 'center' },
  duePillNum: { color: colors.bg, fontSize: 28, fontWeight: '800' },
  duePillLabel: { color: 'rgba(0,0,0,0.55)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  dueDivider: { width: 1, height: 32, backgroundColor: 'rgba(0,0,0,0.15)' },

  allDoneCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(74,222,128,0.08)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  allDoneEmoji: { fontSize: 28 },
  allDoneTitle: { color: '#4ade80', fontWeight: '700', fontSize: 15 },
  allDoneSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 3 },

  masteryCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  masteryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  masteryLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  masteryPct: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  masteryTrack: { height: 6, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  masteryFill: { height: '100%', backgroundColor: '#e879f9', borderRadius: 3 },
  masterySub: { color: colors.textMuted, fontSize: 12 },

  sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 10, marginTop: 4 },

  primaryGrid: { paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  primaryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  primaryIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  quickLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },

  wodCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: '#0c0c0c', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1c1c1c' },
  wodEye: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 },
  wodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  wodWord: { fontSize: 24, fontWeight: '800', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  cefrText: { fontSize: 10, fontWeight: '800' },
  wodTr: { color: colors.textMuted, fontSize: 14 },

  section: { marginBottom: 8 },
  historyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.bgCard, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: colors.border },
  historyIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },

  emptyState: { marginHorizontal: 20, marginTop: 8, backgroundColor: colors.bgCard, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 18 },
  emptyCta: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13 },
  emptyCtaText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
})
