import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { getCurrentUser, ReplitUser } from '../../lib/auth'
import { getWordOfDay, WordOfDayPayload } from '../../lib/api'
import { getDueCount, getStats, ReadingHistoryItem, listReadingHistory } from '../../lib/dataApi'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

const SW = Dimensions.get('window').width

interface Stats { total: number; today: number; week: number; mastered: number; streak: number }
interface Due { due: number; newWords: number; learning: number }

export default function DashboardScreen() {
  const [user, setUser] = useState<ReplitUser | null>(null)
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, week: 0, mastered: 0, streak: 0 })
  const [due, setDue] = useState<Due>({ due: 0, newWords: 0, learning: 0 })
  const [wod, setWod] = useState<WordOfDayPayload | null>(null)
  const [history, setHistory] = useState<ReadingHistoryItem[]>([])
  const router = useRouter()

  useFocusEffect(useCallback(() => { load() }, []))

  async function load() {
    const user = await getCurrentUser()
    if (!user) return
    setUser(user)
    const [statsData, dueData, histData] = await Promise.all([
      getStats(),
      getDueCount(),
      listReadingHistory(),
    ])
    setStats(statsData)
    setDue(dueData)
    setHistory(histData.slice(0, 3))
    try { setWod(await getWordOfDay()) } catch {}
  }

  const name = user?.name?.split(' ')[0] || 'Kullanıcı'
  const initials = (user?.name || 'K').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const avatar = user?.avatar_url
  const masteryPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0
  const totalDue = due.due + due.newWords

  return (
    <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
          {avatar
            ? <Image source={{ uri: avatar }} style={S.avatar} />
            : <View style={S.avatar}><Text style={S.avatarTxt}>{initials}</Text></View>}
        </TouchableOpacity>
        <View style={S.headerMid}>
          <Text style={S.greeting}>Merhaba, {name} 👋</Text>
          {stats.streak > 0 && <Text style={S.streak}>🔥 {stats.streak} günlük seri</Text>}
        </View>
      </View>

      {/* HERO */}
      {totalDue > 0 ? (
        <TouchableOpacity style={S.hero} onPress={() => router.push('/(tabs)/flashcards')} activeOpacity={0.87}>
          <View>
            <Text style={S.heroLabel}>SM-2 TEKRAR</Text>
            <Text style={S.heroTitle}>{totalDue} kart seni bekliyor</Text>
          </View>
          <View style={S.heroMeta}>
            <View style={S.heroPill}><Text style={S.heroPillN}>{due.due}</Text><Text style={S.heroPillL}>bekleyen</Text></View>
            <View style={S.heroDivider} />
            <View style={S.heroPill}><Text style={S.heroPillN}>{due.newWords}</Text><Text style={S.heroPillL}>yeni</Text></View>
            <View style={S.heroDivider} />
            <View style={S.heroPill}><Text style={S.heroPillN}>{due.learning}</Text><Text style={S.heroPillL}>öğreniliyor</Text></View>
            <View style={S.heroArrow}><Ionicons name="arrow-forward" size={18} color={colors.bg} /></View>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={S.heroDone}>
          <Text style={S.heroDoneEmoji}>✅</Text>
          <View>
            <Text style={S.heroDoneTitle}>Bugün tamamlandı!</Text>
            <Text style={S.heroDoneSub}>Tüm kartlarını bitirdin.</Text>
          </View>
        </View>
      )}

      {/* STATS */}
      <View style={S.statsRow}>
        {[
          { v: stats.total, l: 'Kelime', c: colors.accent },
          { v: stats.mastered, l: 'Öğrenildi', c: '#4ade80' },
          { v: stats.today, l: 'Bugün', c: '#60a5fa' },
          { v: stats.week, l: 'Hafta', c: '#fb923c' },
        ].map(({ v, l, c }) => (
          <View key={l} style={S.statBox}>
            <Text style={[S.statVal, { color: c }]}>{v}</Text>
            <Text style={S.statLbl}>{l}</Text>
          </View>
        ))}
      </View>

      {/* PROGRESS BAR */}
      {stats.total > 0 && (
        <View style={S.progRow}>
          <Text style={S.progLbl}>Öğrenme ilerlemen</Text>
          <Text style={S.progPct}>{masteryPct}%</Text>
        </View>
      )}
      {stats.total > 0 && (
        <View style={S.progTrack}>
          <View style={[S.progFill, { width: `${masteryPct}%` as any }]} />
        </View>
      )}

      {/* ACTIONS */}
      <Text style={S.sec}>BAŞLA</Text>
      <View style={S.iconGrid}>
        {([
          { icon: 'book-outline', label: 'Oku', color: '#facc15', route: '/(tabs)/oku' },
          { icon: 'compass-outline', label: 'Keşfet', color: '#60a5fa', route: '/(tabs)/catalog' },
          { icon: 'layers-outline', label: 'Flashcard', color: '#4ade80', route: '/(tabs)/flashcards' },
          { icon: 'game-controller-outline', label: 'Quiz', color: '#e879f9', route: '/(tabs)/quiz' },
          { icon: 'camera-outline', label: 'Kamera', color: '#fb923c', route: '/(tabs)/camera' },
          { icon: 'play-circle-outline', label: 'Video', color: '#f87171', route: '/(tabs)/video' },
        ] as { icon: any; label: string; color: string; route: string }[]).map(({ icon, label, color, route }) => (
          <TouchableOpacity key={label} style={S.iconCell} onPress={() => router.push(route as any)} activeOpacity={0.78}>
            <View style={[S.iconCircle, { backgroundColor: color + '1a' }]}>
              <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={S.iconLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* QUICK ROW */}
      <Text style={S.sec}>HIZLI ERİŞİM</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.quickScroll}>
        {([
          { icon: 'search-outline', label: 'Kelime Ara', route: '/(tabs)/search' },
          { icon: 'list-outline', label: 'Kelimelerim', route: '/(tabs)/words' },
          { icon: 'folder-outline', label: 'Listeler', route: '/(tabs)/collections' },
          { icon: 'time-outline', label: 'Geçmiş', route: '/(tabs)/history' },
        ] as { icon: any; label: string; route: string }[]).map(({ icon, label, route }) => (
          <TouchableOpacity key={label} style={S.quickPill} onPress={() => router.push(route as any)} activeOpacity={0.8}>
            <Ionicons name={icon} size={14} color={colors.accent} />
            <Text style={S.quickPillTxt}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* WORD OF DAY */}
      {wod && (
        <View style={S.wod}>
          <Text style={S.wodEye}>⚡ GÜNÜN KELİMESİ</Text>
          <View style={S.wodRow}>
            <Text style={S.wodWord}>{wod.word}</Text>
            {wod.cefr && (
              <View style={[S.cefrTag, { borderColor: cefrColors[wod.cefr] || colors.border }]}>
                <Text style={[S.cefrTxt, { color: cefrColors[wod.cefr] || colors.textMuted }]}>{wod.cefr}</Text>
              </View>
            )}
          </View>
          <Text style={S.wodTr}>{wod.translation}</Text>
        </View>
      )}

      {/* RECENT */}
      {history.length > 0 && (
        <View>
          <Text style={S.sec}>DEVAM ET</Text>
          {history.map(h => (
            <TouchableOpacity
              key={h.id} style={S.histRow}
              onPress={() => router.push({ pathname: '/(tabs)/oku', params: h.url ? { prefillUrl: h.url } : {} })}
              activeOpacity={0.8}
            >
              <View style={S.histIco}><Ionicons name="book-outline" size={13} color={colors.accent} /></View>
              <Text style={S.histTitle} numberOfLines={1}>{h.title || h.url || 'Manuel metin'}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* EMPTY */}
      {stats.total === 0 && (
        <View style={S.empty}>
          <Text style={S.emptyEmoji}>🚀</Text>
          <Text style={S.emptyTitle}>İlk kelimenizi kaydedin</Text>
          <Text style={S.emptySub}>Makale okuyun, kelimelere dokunun, sonra flashcard ile tekrar edin.</Text>
          <TouchableOpacity style={S.emptyCta} onPress={() => router.push('/(tabs)/catalog')}>
            <Text style={S.emptyCtaTxt}>Makale Keşfet →</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  )
}

const ICON_CELL = (SW - 40 - 40) / 6

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 56 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 17, fontWeight: '900', color: colors.bg },
  headerMid: { flex: 1 },
  greeting: { fontSize: 20, fontWeight: '800', color: colors.text },
  streak: { fontSize: 12, color: '#fb923c', fontWeight: '700', marginTop: 2 },
  hero: { marginHorizontal: 20, marginBottom: 14, backgroundColor: colors.accent, borderRadius: 20, padding: 20 },
  heroLabel: { color: 'rgba(0,0,0,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4 },
  heroTitle: { color: colors.bg, fontSize: 21, fontWeight: '900', marginBottom: 16 },
  heroMeta: { flexDirection: 'row', alignItems: 'center' },
  heroPill: { alignItems: 'center', flex: 1 },
  heroPillN: { color: colors.bg, fontSize: 22, fontWeight: '900' },
  heroPillL: { color: 'rgba(0,0,0,0.45)', fontSize: 9, fontWeight: '700', marginTop: 1 },
  heroDivider: { width: 1, height: 26, backgroundColor: 'rgba(0,0,0,0.15)', marginHorizontal: 4 },
  heroArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  heroDone: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 14, backgroundColor: 'rgba(74,222,128,0.07)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)', borderRadius: 16, padding: 16 },
  heroDoneEmoji: { fontSize: 26 },
  heroDoneTitle: { color: '#4ade80', fontWeight: '700', fontSize: 14 },
  heroDoneSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 11, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { color: colors.textMuted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  progRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 6 },
  progLbl: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  progPct: { color: '#e879f9', fontSize: 11, fontWeight: '800' },
  progTrack: { height: 5, marginHorizontal: 20, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden', marginBottom: 20 },
  progFill: { height: '100%', backgroundColor: '#e879f9', borderRadius: 3 },
  sec: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, paddingHorizontal: 20, marginBottom: 12 },
  iconGrid: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between', marginBottom: 20 },
  iconCell: { alignItems: 'center', width: ICON_CELL + 8, gap: 6 },
  iconCircle: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  quickScroll: { paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  quickPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  quickPillTxt: { color: colors.text, fontSize: 12, fontWeight: '600' },
  wod: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#0b0b18', borderRadius: 18, borderWidth: 1, borderColor: '#1c1c32', padding: 18 },
  wodEye: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  wodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
  wodWord: { fontSize: 26, fontWeight: '900', color: colors.text },
  cefrTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cefrTxt: { fontSize: 10, fontWeight: '800' },
  wodTr: { color: colors.textMuted, fontSize: 14 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  histIco: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(250,204,21,0.1)', alignItems: 'center', justifyContent: 'center' },
  histTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  empty: { marginHorizontal: 20, marginTop: 4, backgroundColor: colors.bgCard, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 26, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  emptySub: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 18 },
  emptyCta: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  emptyCtaTxt: { color: colors.bg, fontWeight: '800', fontSize: 14 },
})
