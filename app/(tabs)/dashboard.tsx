'use client'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { useRouter } from 'expo-router'
import { getRecentActivity, computeStreak, DailyActivity, StreakInfo } from '../../lib/streak'

function getLastNDays(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

export default function DashboardScreen() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ total: 0, today: 0, week: 0, mastered: 0 })
  const [wordOfDay, setWordOfDay] = useState<any>(null)
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null)
  const [activityMap, setActivityMap] = useState<Record<string, DailyActivity>>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const cefrColors: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [all, todayRes, weekRes, activities] = await Promise.all([
      supabase.from('saved_words').select('*').eq('user_id', user.id),
      supabase.from('saved_words').select('id', { count: 'exact' }).eq('user_id', user.id).gte('created_at', today),
      supabase.from('saved_words').select('id', { count: 'exact' }).eq('user_id', user.id).gte('created_at', weekAgo),
      getRecentActivity(30),
    ])

    setStats({
      total: all.data?.length || 0,
      today: todayRes.count || 0,
      week: weekRes.count || 0,
      mastered: all.data?.filter((w: any) => w.mastered).length || 0,
    })

    const map: Record<string, DailyActivity> = {}
    for (const a of activities) map[a.day] = a
    setActivityMap(map)
    setStreakInfo(computeStreak(activities, today))

    try {
      const res = await fetch('https://lexitr.vercel.app/api/word-of-day')
      const wod = await res.json()
      setWordOfDay(wod)
    } catch (e) {}

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const name = user?.user_metadata?.full_name?.split(' ')[0] || 'Kullanıcı'
  const last7 = getLastNDays(7)
  const today = new Date().toISOString().split('T')[0]

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, Platform.OS === 'web' && { paddingTop: 67 + 16 }]}
    >
      <Text style={styles.greeting}>Merhaba, {name} 👋</Text>

      <View style={styles.grid}>
        {[
          { label: 'Toplam Kelime', value: stats.total },
          { label: 'Bugün', value: stats.today },
          { label: 'Bu Hafta', value: stats.week },
          { label: 'Öğrenildi', value: stats.mastered },
        ].map((s) => (
          <View key={s.label} style={styles.card}>
            <Text style={styles.cardValue}>{s.value}</Text>
            <Text style={styles.cardLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {streakInfo !== null && (
        <View style={[styles.streakCard, streakInfo.todayMet && styles.streakCardMet]}>
          <View style={styles.streakTop}>
            <View>
              <View style={styles.streakFlameRow}>
                <Text style={styles.streakFlame}>🔥</Text>
                <Text style={styles.streakNumber}>{streakInfo.current}</Text>
                <Text style={styles.streakLabel}> günlük seri</Text>
              </View>
              <Text style={styles.streakLongest}>En uzun: {streakInfo.longest} gün</Text>
              {streakInfo.todayMet && (
                <Text style={styles.streakGoalMet}>✓ Bugünkü hedef tamamlandı!</Text>
              )}
            </View>
          </View>
          <View style={styles.heatmap}>
            {last7.map((day) => {
              const activity = activityMap[day]
              const met = activity?.goalMet ?? false
              const isToday = day === today
              return (
                <View key={day} style={styles.heatmapCol}>
                  <View style={[
                    styles.heatmapBox,
                    met && styles.heatmapBoxMet,
                    isToday && styles.heatmapBoxToday,
                  ]} />
                  <Text style={styles.heatmapDay}>
                    {new Date(day + 'T00:00:00Z').toLocaleDateString('tr', { weekday: 'narrow' })}
                  </Text>
                </View>
              )
            })}
          </View>
          {!streakInfo.todayMet && (
            <Text style={styles.streakFreezeHint}>⭐ Streak Freeze — yakında</Text>
          )}
        </View>
      )}

      {wordOfDay && (
        <View style={styles.wodCard}>
          <Text style={styles.wodLabel}>⚡ GÜNÜN KELİMESİ</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
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

      <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      <View style={{ height: Platform.OS === 'web' ? 34 : 0 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 60 },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  card: { width: '47%', backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border },
  cardValue: { fontSize: 32, fontWeight: '800', color: colors.accent },
  cardLabel: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  streakCard: {
    backgroundColor: colors.bgCard, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  streakCardMet: { borderColor: '#4ade80' },
  streakTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  streakFlameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  streakFlame: { fontSize: 28 },
  streakNumber: { fontSize: 36, fontWeight: '800', color: colors.accent },
  streakLabel: { fontSize: 14, color: colors.textMuted, alignSelf: 'flex-end', marginBottom: 4 },
  streakLongest: { fontSize: 12, color: colors.textMuted },
  streakGoalMet: { fontSize: 12, color: '#4ade80', marginTop: 4, fontWeight: '600' },
  heatmap: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  heatmapCol: { alignItems: 'center', gap: 4, flex: 1 },
  heatmapBox: {
    width: '100%', aspectRatio: 1, borderRadius: 6,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#222',
  },
  heatmapBoxMet: { backgroundColor: colors.accent, borderColor: colors.accent },
  heatmapBoxToday: { borderColor: colors.accent, borderWidth: 2 },
  heatmapDay: { fontSize: 9, color: colors.textMuted },
  streakFreezeHint: { fontSize: 11, color: colors.textMuted, marginTop: 10, textAlign: 'center' },
  wodCard: { backgroundColor: '#0f0f0f', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1a1a1a' },
  wodLabel: { color: '#facc15', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  wodWord: { fontSize: 22, fontWeight: '800', color: '#f0f0f0' },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cefrText: { fontSize: 11, fontWeight: '700' },
  wodTr: { color: '#999', fontSize: 14, marginTop: 4 },
  signOutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, alignItems: 'center' },
  signOutText: { color: colors.textMuted, fontWeight: '600' },
})
