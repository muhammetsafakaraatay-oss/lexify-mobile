import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import type { User } from '@supabase/supabase-js'
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
}

export default function DashboardScreen() {
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, week: 0, mastered: 0 })
  const [dueCount, setDueCount] = useState({ due: 0, newWords: 0, learning: 0 })
  const [wordOfDay, setWordOfDay] = useState<WordOfDayPayload | null>(null)
  const [recentHistory, setRecentHistory] = useState<ReadingHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setUser(user)

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [totalRes, masteredRes, todayRes, weekRes, historyRes, due] = await Promise.all([
      supabase
        .from('saved_words')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('saved_words')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('stage', 'mastered'),
      supabase
        .from('saved_words')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', today),
      supabase
        .from('saved_words')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', weekAgo),
      supabase
        .from('reading_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
      getDueCount(),
    ])

    setStats({
      total: totalRes.count ?? 0,
      mastered: masteredRes.count ?? 0,
      today: todayRes.count ?? 0,
      week: weekRes.count ?? 0,
    })
    setDueCount(due)
    setRecentHistory((historyRes.data ?? []) as ReadingHistoryItem[])

    try {
      setWordOfDay(await getWordOfDay())
    } catch (e) {
      console.warn('[dashboard] getWordOfDay failed:', e)
    }

    setLoading(false)
  }

  const name = user?.user_metadata?.full_name?.split(' ')[0] || 'Kullanici'
  const primaryActions = [
    { label: 'Metin Oku', icon: 'book-outline' as const, route: '/(tabs)/oku' },
    { label: 'Makale Keşfet', icon: 'compass-outline' as const, route: '/(tabs)/catalog' },
    { label: 'Kamera Tara', icon: 'camera-outline' as const, route: '/(tabs)/camera' },
    { label: 'Video Çalış', icon: 'play-circle-outline' as const, route: '/(tabs)/video' },
  ]
  const secondaryActions = [
    { label: 'Kelime Ara', route: '/(tabs)/search' },
    { label: 'Flashcard', route: '/(tabs)/flashcards' },
    { label: 'Quiz', route: '/(tabs)/quiz' },
    { label: 'Listeler', route: '/(tabs)/collections' },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>LEXITR MOBILE</Text>
        <Text style={styles.greeting}>Merhaba, {name} 👋</Text>
        <Text style={styles.heroSub}>
          Bugün öğrenmeye okumayla başla, kamerayla kelime yakala ya da videodan transcript üzerinden çalış.
        </Text>
      </View>

      {(dueCount.due > 0 || dueCount.newWords > 0) && (
        <TouchableOpacity
          style={styles.dueCard}
          onPress={() => router.push('/(tabs)/flashcards')}
          activeOpacity={0.85}
        >
          <View style={styles.dueCardHeader}>
            <Text style={styles.dueCardLabel}>BUGÜN GÖZDEN GEÇİR</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.bg} />
          </View>
          <View style={styles.dueCardRow}>
            <View style={styles.dueStat}>
              <Text style={styles.dueStatValue}>{dueCount.due}</Text>
              <Text style={styles.dueStatLabel}>review</Text>
            </View>
            <View style={styles.dueDivider} />
            <View style={styles.dueStat}>
              <Text style={styles.dueStatValue}>{dueCount.newWords}</Text>
              <Text style={styles.dueStatLabel}>yeni</Text>
            </View>
            <View style={styles.dueDivider} />
            <View style={styles.dueStat}>
              <Text style={styles.dueStatValue}>{dueCount.learning}</Text>
              <Text style={styles.dueStatLabel}>öğreniliyor</Text>
            </View>
          </View>
          <Text style={styles.dueCardSub}>SM-2 algoritmasıyla aralıklı tekrar — bugünün kartlarını bitir, seriyi koru.</Text>
        </TouchableOpacity>
      )}

      <View style={styles.primaryGrid}>
        {primaryActions.map((action) => (
          <TouchableOpacity key={action.label} style={styles.primaryCard} onPress={() => router.push(action.route as any)}>
            <Ionicons name={action.icon} size={22} color={colors.accent} />
            <Text style={styles.primaryCardTitle}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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

      {stats.total === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>İlk öğrenme döngünü başlat</Text>
          <Text style={styles.emptyText}>
            Ürün hissi ilk başarıyla gelir. Önce bir metin aç, birkaç kelime kaydet, sonra flashcard ile tekrar et.
          </Text>
          <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(tabs)/catalog')}>
            <Text style={styles.emptyCtaText}>Makale Keşfet</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
          <TouchableOpacity style={styles.inlineAction} onPress={() => router.push('/(tabs)/words')}>
            <Text style={styles.inlineActionText}>Kelimelerime Git</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
        <View style={styles.secondaryGrid}>
          {secondaryActions.map((action) => (
            <TouchableOpacity key={action.label} style={styles.secondaryCard} onPress={() => router.push(action.route as any)}>
              <Text style={styles.secondaryCardText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {recentHistory.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kaldığın Yerden Devam Et</Text>
          {recentHistory.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.historyCard}
              onPress={() => router.push({ pathname: '/(tabs)/oku', params: item.url ? { prefillUrl: item.url } : {} })}
            >
              <Text style={styles.historyTitle} numberOfLines={1}>{item.title || item.url || 'Manuel metin'}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 60 },
  hero: { marginBottom: 22 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 24 },
  heroSub: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: -12 },
  dueCard: {
    backgroundColor: colors.accent, borderRadius: 18, padding: 18, marginBottom: 18,
  },
  dueCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dueCardLabel: { color: colors.bg, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  dueCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dueStat: { flex: 1, alignItems: 'center' },
  dueStatValue: { color: colors.bg, fontSize: 28, fontWeight: '800' },
  dueStatLabel: { color: 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: '700', marginTop: 2 },
  dueDivider: { width: 1, height: 28, backgroundColor: 'rgba(0,0,0,0.2)' },
  dueCardSub: { color: 'rgba(0,0,0,0.7)', fontSize: 12, lineHeight: 18 },
  primaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  primaryCard: { width: '47%', backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 },
  primaryCardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: { width: '47%', backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border },
  cardValue: { fontSize: 32, fontWeight: '800', color: colors.accent },
  cardLabel: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  emptyState: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  emptyCta: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  emptyCtaText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  wodCard: { backgroundColor: '#0f0f0f', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1a1a1a' },
  wodLabel: { color: '#facc15', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  wodWord: { fontSize: 22, fontWeight: '800', color: '#f0f0f0' },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cefrText: { fontSize: 11, fontWeight: '700' },
  wodTr: { color: '#999', fontSize: 14, marginTop: 4 },
  inlineAction: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: colors.accentDim, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  inlineActionText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  section: { marginBottom: 18 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  secondaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryCardText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  historyCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10 },
  historyTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  signOutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, alignItems: 'center' },
  signOutText: { color: colors.textMuted, fontWeight: '600' },
})
