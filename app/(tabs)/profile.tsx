import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, ActivityIndicator, Image
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [cefrDist, setCefrDist] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const cefrColor: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUser(user)

    const { data: words } = await supabase
      .from('saved_words').select('*').eq('user_id', user.id)

    const all = words || []
    const mastered = all.filter((w: any) => w.mastered).length
    const total = all.length

    const dist: Record<string, number> = {}
    all.forEach((w: any) => {
      if (w.cefr) dist[w.cefr] = (dist[w.cefr] || 0) + 1
    })

    setStats({ total, mastered, streak: 0 })
    setCefrDist(dist)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  )

  const name = user?.user_metadata?.full_name || 'Kullanici'
  const email = user?.email || ''
  const avatar = user?.user_metadata?.avatar_url

  const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const maxCefr = Math.max(...Object.values(cefrDist), 1)

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{name[0]}</Text>
            </View>
          )}
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Toplam', value: stats?.total || 0 },
            { label: 'Ogrenildi', value: stats?.mastered || 0 },
            { label: 'Kalan', value: (stats?.total || 0) - (stats?.mastered || 0) },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {Object.keys(cefrDist).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CEFR Dagilimi</Text>
            {cefrOrder.filter(l => cefrDist[l]).map(level => (
              <View key={level} style={styles.cefrRow}>
                <Text style={[styles.cefrLabel, { color: cefrColor[level] }]}>{level}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, {
                    width: `${(cefrDist[level] / maxCefr) * 100}%`,
                    backgroundColor: cefrColor[level]
                  }]} />
                </View>
                <Text style={styles.cefrCount}>{cefrDist[level]}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color="#f87171" />
          <Text style={styles.signOutText}>Cikis Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 40 },
  profileCard: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.bg },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  email: { fontSize: 14, color: colors.textMuted },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.accent },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  section: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 },
  cefrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cefrLabel: { width: 28, fontSize: 13, fontWeight: '700' },
  barBg: { flex: 1, height: 8, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  cefrCount: { width: 24, fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#f87171', borderRadius: 12, padding: 14, justifyContent: 'center' },
  signOutText: { color: '#f87171', fontWeight: '600', fontSize: 15 },
})
