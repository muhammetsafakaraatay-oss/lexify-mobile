'use client'
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { useRouter } from 'expo-router'

export default function DashboardScreen() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ total: 0, today: 0, week: 0, mastered: 0 })
  const [wordOfDay, setWordOfDay] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const cefrColors: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [all, todayRes, weekRes] = await Promise.all([
      supabase.from('saved_words').select('*').eq('user_id', user.id),
      supabase.from('saved_words').select('id', { count: 'exact' }).eq('user_id', user.id).gte('created_at', today),
      supabase.from('saved_words').select('id', { count: 'exact' }).eq('user_id', user.id).gte('created_at', weekAgo),
    ])

    setStats({
      total: all.data?.length || 0,
      today: todayRes.count || 0,
      week: weekRes.count || 0,
      mastered: all.data?.filter((w: any) => w.mastered).length || 0,
    })

    try {
      const res = await fetch('https://lexitr.vercel.app/api/word-of-day')
      const wod = await res.json()
      setWordOfDay(wod)
    } catch (e) {}

    setLoading(false)
  }

  const name = user?.user_metadata?.full_name?.split(' ')[0] || 'Kullanici'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Merhaba, {name} 👋</Text>

      <View style={styles.grid}>
        {[
          { label: 'Toplam Kelime', value: stats.total },
          { label: 'Bugun', value: stats.today },
          { label: 'Bu Hafta', value: stats.week },
          { label: 'Ogrenildi', value: stats.mastered },
        ].map((s) => (
          <View key={s.label} style={styles.card}>
            <Text style={styles.cardValue}>{s.value}</Text>
            <Text style={styles.cardLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {wordOfDay && (
        <View style={styles.wodCard}>
          <Text style={styles.wodLabel}>⚡ GUNUN KELIMESI</Text>
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
        <Text style={styles.signOutText}>Cikis Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 60 },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: { width: '47%', backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border },
  cardValue: { fontSize: 32, fontWeight: '800', color: colors.accent },
  cardLabel: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  wodCard: { backgroundColor: '#0f0f0f', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1a1a1a' },
  wodLabel: { color: '#facc15', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  wodWord: { fontSize: 22, fontWeight: '800', color: '#f0f0f0' },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cefrText: { fontSize: 11, fontWeight: '700' },
  wodTr: { color: '#999', fontSize: 14, marginTop: 4 },
  signOutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, alignItems: 'center' },
  signOutText: { color: colors.textMuted, fontWeight: '600' },
})
