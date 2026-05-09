import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image, Switch, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'expo-router'
import { colors, radius } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { getRecentActivity, computeStreak, DailyActivity, StreakInfo } from '../../lib/streak'
import { getPreferences, upsertPreferences, UserPreferences } from '../../lib/preferences'
import { scheduleDailyReminder, cancelDailyReminder } from '../../lib/notifications'

const GOALS = [5, 10, 15, 20, 30]

function getLastNDays(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ total: 0, mastered: 0, today: 0, week: 0 })
  const [cefrDist, setCefrDist] = useState<Record<string, number>>({})
  const [recentHistory, setRecentHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null)
  const [activityMap, setActivityMap] = useState<Record<string, DailyActivity>>({})
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [savingGoal, setSavingGoal] = useState(false)
  const router = useRouter()

  const cefrColor: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUser(user)

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [all, todayRes, weekRes, historyRes, activities, userPrefs] = await Promise.all([
      supabase.from('saved_words').select('*').eq('user_id', user.id),
      supabase.from('saved_words').select('id', { count: 'exact' }).eq('user_id', user.id).gte('created_at', today),
      supabase.from('saved_words').select('id', { count: 'exact' }).eq('user_id', user.id).gte('created_at', weekAgo),
      supabase.from('reading_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
      getRecentActivity(30),
      getPreferences(),
    ])

    const words = all.data || []
    const dist: Record<string, number> = {}
    words.forEach((w: any) => { if (w.cefr) dist[w.cefr] = (dist[w.cefr] || 0) + 1 })

    const map: Record<string, DailyActivity> = {}
    for (const a of activities) map[a.day] = a
    setActivityMap(map)
    setStreakInfo(computeStreak(activities, today))
    setPrefs(userPrefs)

    setStats({
      total: words.length,
      mastered: words.filter((w: any) => w.mastered).length,
      today: todayRes.count || 0,
      week: weekRes.count || 0,
    })
    setCefrDist(dist)
    setRecentHistory(historyRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function updateGoal(goal: number) {
    setSavingGoal(true)
    await upsertPreferences({ dailyGoal: goal })
    setPrefs(p => p ? { ...p, dailyGoal: goal } : p)
    setSavingGoal(false)
  }

  async function toggleReminder(val: boolean) {
    await upsertPreferences({ reminderEnabled: val })
    setPrefs(p => p ? { ...p, reminderEnabled: val } : p)
    if (val && prefs?.reminderHour != null && prefs?.reminderMinute != null) {
      await scheduleDailyReminder(prefs.reminderHour, prefs.reminderMinute)
    } else {
      await cancelDailyReminder()
    }
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor(diff / 3600000)
    if (days > 0) return days + ' gün önce'
    if (hours > 0) return hours + ' saat önce'
    return 'Az önce'
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  const name = user?.user_metadata?.full_name || 'Kullanıcı'
  const avatar = user?.user_metadata?.avatar_url
  const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const maxCefr = Math.max(...Object.values(cefrDist), 1)
  const last30 = getLastNDays(30)
  const today = new Date().toISOString().split('T')[0]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, Platform.OS === 'web' && { paddingTop: 16 }]}>

        <View style={styles.profileCard}>
          {avatar
            ? <Image source={{ uri: avatar }} style={styles.avatar} />
            : <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{name[0]}</Text></View>
          }
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {prefs?.cefrLevel && (
            <View style={[styles.cefrBadgeLg, { borderColor: cefrColor[prefs.cefrLevel] }]}>
              <Text style={[styles.cefrBadgeLgText, { color: cefrColor[prefs.cefrLevel] }]}>
                {prefs.cefrLevel}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Toplam', value: stats.total, color: colors.accent },
            { label: 'Bugün', value: stats.today, color: '#4ade80' },
            { label: 'Öğrenildi', value: stats.mastered, color: '#e879f9' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {streakInfo !== null && (
          <View style={[styles.section, streakInfo.todayMet && styles.sectionGreen]}>
            <View style={styles.streakHeader}>
              <View style={styles.streakFlameRow}>
                <Text style={styles.streakFlame}>🔥</Text>
                <Text style={styles.streakNumber}>{streakInfo.current}</Text>
                <Text style={styles.streakDays}> günlük seri</Text>
              </View>
              <Text style={styles.streakLongest}>En uzun: {streakInfo.longest} gün</Text>
            </View>

            {streakInfo.todayMet && (
              <Text style={styles.goalMetText}>✓ Bugünkü hedef tamamlandı!</Text>
            )}

            <Text style={styles.heatmapLabel}>Son 30 Gün</Text>
            <View style={styles.heatmap30}>
              {last30.map((day) => {
                const met = activityMap[day]?.goalMet ?? false
                const isToday = day === today
                return (
                  <View
                    key={day}
                    style={[
                      styles.heatBox,
                      met && styles.heatBoxMet,
                      isToday && styles.heatBoxToday,
                    ]}
                  />
                )
              })}
            </View>

            <Text style={styles.streakFreezeHint}>⭐ Streak Freeze — yakında</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Günlük Hedef</Text>
          <View style={styles.goalRow}>
            {GOALS.map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.goalChip, prefs?.dailyGoal === g && styles.goalChipActive]}
                onPress={() => updateGoal(g)}
                disabled={savingGoal}
              >
                <Text style={[styles.goalChipText, prefs?.dailyGoal === g && styles.goalChipTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Hatırlatmalar</Text>
          <View style={styles.reminderRow}>
            <View>
              <Text style={styles.reminderTitle}>Günlük Hatırlatma</Text>
              {prefs?.reminderHour != null && prefs?.reminderMinute != null && (
                <Text style={styles.reminderTime}>
                  {String(prefs.reminderHour).padStart(2, '0')}:{String(prefs.reminderMinute).padStart(2, '0')}
                </Text>
              )}
            </View>
            <Switch
              value={prefs?.reminderEnabled ?? false}
              onValueChange={toggleReminder}
              trackColor={{ false: '#333', true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

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
            <Text style={styles.sectionTitle}>📊 CEFR Dağılımı</Text>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Ayarlar</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/(tabs)/collections')}>
            <Text style={styles.settingText}>📁 Listelerim</Text>
            <Text style={{ color: colors.textMuted }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.settingText}>📖 Okuma Geçmişi</Text>
            <Text style={{ color: colors.textMuted }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/(tabs)/search')}>
            <Text style={styles.settingText}>🔍 Kelime Ara</Text>
            <Text style={{ color: colors.textMuted }}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
          <Ionicons name="log-out-outline" size={20} color="#f87171" />
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <View style={{ height: Platform.OS === 'web' ? 34 : 0 }} />
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
  email: { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  cefrBadgeLg: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  cefrBadgeLgText: { fontSize: 13, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  section: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  sectionGreen: { borderColor: '#4ade80' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  streakFlameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakFlame: { fontSize: 24 },
  streakNumber: { fontSize: 32, fontWeight: '800', color: colors.accent },
  streakDays: { fontSize: 13, color: colors.textMuted, alignSelf: 'flex-end', marginBottom: 4 },
  streakLongest: { fontSize: 12, color: colors.textMuted },
  goalMetText: { color: '#4ade80', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  heatmapLabel: { fontSize: 11, color: colors.textMuted, marginTop: 8, marginBottom: 8 },
  heatmap30: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatBox: { width: 20, height: 20, borderRadius: 4, backgroundColor: '#1a1a1a' },
  heatBoxMet: { backgroundColor: colors.accent },
  heatBoxToday: { borderWidth: 1.5, borderColor: colors.accent },
  streakFreezeHint: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  goalRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  goalChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSurface,
  },
  goalChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  goalChipText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  goalChipTextActive: { color: colors.bg },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reminderTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  reminderTime: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
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
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  settingText: { color: colors.text, fontSize: 15 },
})
