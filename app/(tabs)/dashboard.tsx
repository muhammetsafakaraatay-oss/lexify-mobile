import { useCallback, useRef, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { getWordOfDay, WordOfDayPayload } from '../../lib/api'
import { getDueCount, listSavedWords, ReadingHistoryItem, upsertSavedWord } from '../../lib/data'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { getUserPrefs, type CefrLevel } from '../../lib/prefs'
import { isGuestMode } from '../../lib/guest'
import { FirstWinCard } from '../../components/ui/FirstWinCard'
import { WeeklyInsightsCard } from '../../components/ui/WeeklyInsightsCard'
import { LevelPathCard } from '../../components/ui/LevelPathCard'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { usePremium } from '../../contexts/SubscriptionContext'
import { DailyGoalCard } from '../../components/ui/DailyGoalCard'
import { ProUpsellBanner } from '../../components/ui/ProUpsellBanner'
import { FreePlanBanner } from '../../components/ui/FreePlanBanner'
import { FadeInView } from '../../components/ui/FadeInView'

interface Stats {
  total: number
  today: number
  week: number
  mastered: number
  streak: number
}

import { computeStreakFromDates } from '../../lib/streak'

export default function DashboardScreen() {
  const { isPro } = usePremium()
  const [user, setUser] = useState<User | null>(null)
  const [dailyGoal, setDailyGoal] = useState(10)
  const [userLevel, setUserLevel] = useState<CefrLevel>('B1')
  const [guest, setGuest] = useState(false)
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, week: 0, mastered: 0, streak: 0 })
  const [dueCount, setDueCount] = useState({ due: 0, newWords: 0, learning: 0 })
  const [wordOfDay, setWordOfDay] = useState<WordOfDayPayload | null>(null)
  const [recentHistory, setRecentHistory] = useState<ReadingHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [wodSaved, setWodSaved] = useState(false)
  const hasLoadedOnce = useRef(false)
  const router = useRouter()

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const prefs = await getUserPrefs()
      setDailyGoal(prefs.dailyGoal)
      setUserLevel(prefs.level)
      setGuest(await isGuestMode())

      const { data: { user } } = await supabase.auth.getUser()
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      if (!user) {
        const [words, due, nextWordOfDay] = await Promise.all([
          listSavedWords({ orderBy: 'created_at', ascending: false }),
          getDueCount(),
          getWordOfDay().catch((e) => {
            console.warn('[dashboard] getWordOfDay failed:', e)
            return null
          }),
        ])

        const streak = computeStreakFromDates(words.map((w) => w.created_at))

        setStats({
          total: words.length,
          mastered: words.filter((w) => w.stage === 'mastered').length,
          today: words.filter((w) => (w.created_at ?? '').startsWith(today)).length,
          week: words.filter((w) => (w.created_at ?? '') >= weekAgo).length,
          streak,
        })
        setDueCount(due)
        setWordOfDay(nextWordOfDay)
        setWodSaved(
          !!nextWordOfDay?.word &&
            words.some((word) => word.word?.trim().toLowerCase() === nextWordOfDay.word?.trim().toLowerCase()),
        )
        return
      }

      setUser(user)

      const [totalRes, masteredRes, todayRes, weekRes, historyRes, allWordsRes, due, nextWordOfDay] = await Promise.all([
        supabase.from('saved_words').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('saved_words').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('stage', 'mastered'),
        supabase.from('saved_words').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', today),
        supabase.from('saved_words').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekAgo),
        supabase.from('reading_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
        supabase.from('saved_words').select('created_at, word').eq('user_id', user.id),
        getDueCount(),
        getWordOfDay().catch((e) => {
          console.warn('[dashboard] getWordOfDay failed:', e)
          return null
        }),
      ])

      const words = (allWordsRes.data ?? []) as { created_at?: string | null; word?: string | null }[]
      const streak = computeStreakFromDates(words.map((w) => w.created_at ?? undefined))

      setStats({
        total: totalRes.count ?? 0,
        mastered: masteredRes.count ?? 0,
        today: todayRes.count ?? 0,
        week: weekRes.count ?? 0,
        streak,
      })
      setDueCount(due)
      setRecentHistory((historyRes.data ?? []) as ReadingHistoryItem[])
      setWordOfDay(nextWordOfDay)
      setWodSaved(
        !!nextWordOfDay?.word &&
          words.some((word) => word.word?.trim().toLowerCase() === nextWordOfDay.word?.trim().toLowerCase()),
      )
    } catch (error) {
      console.warn('[dashboard] load failed:', error)
      setStats({ total: 0, today: 0, week: 0, mastered: 0, streak: 0 })
      setDueCount({ due: 0, newWords: 0, learning: 0 })
      setRecentHistory([])
      setWordOfDay(null)
      setWodSaved(false)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      const silent = hasLoadedOnce.current
      hasLoadedOnce.current = true
      void load({ silent })
    }, [load]),
  )

  async function onRefresh() {
    setRefreshing(true)
    await load({ silent: true })
    setRefreshing(false)
  }

  const name = user?.user_metadata?.full_name?.split(' ')[0] || 'Kullanıcı'
  const primaryActions = [
    { label: 'Metin Oku', icon: 'book-outline' as const, route: '/(tabs)/oku', pro: false },
    { label: 'Makale Keşfet', icon: 'compass-outline' as const, route: '/(tabs)/catalog', pro: false },
    { label: 'Kamera Tara', icon: 'camera-outline' as const, route: '/(tabs)/camera', pro: true },
    { label: 'Video Çalış', icon: 'play-circle-outline' as const, route: '/(tabs)/video', pro: true },
  ]
  const [featuredAction, ...quickActions] = primaryActions
  const secondaryActions = [
    { label: 'Hızlı Pratik', route: '/(tabs)/practice', accent: true },
    { label: 'Kelime Ara', route: '/(tabs)/search' },
    { label: 'Flashcard', route: '/(tabs)/flashcards' },
    { label: 'Quiz', route: '/(tabs)/quiz' },
    { label: 'Listeler', route: '/(tabs)/collections' },
  ]

  async function saveWordOfDay() {
    if (!wordOfDay?.word || wodSaved) return
    await upsertSavedWord({
      word: wordOfDay.word,
      translation: wordOfDay.translation,
      cefr: wordOfDay.cefr,
      source_type: 'manual_text',
      source_title: 'Günün Kelimesi',
    })
    setWodSaved(true)
    Alert.alert('Kaydedildi', `"${wordOfDay.word}" kelimelerine eklendi.`)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      <FadeInView>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.eyebrow}>LEXIFY</Text>
              <Text style={styles.greeting}>
                {guest ? 'Hoş geldin 👋' : `Merhaba, ${name} 👋`}
              </Text>
            </View>
            {stats.streak > 0 && (
              <View style={styles.streakPill}>
                <Text style={styles.streakFire}>🔥</Text>
                <Text style={styles.streakNum}>{stats.streak}</Text>
                <Text style={styles.streakLabel}>gün</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroSub}>
            {guest
              ? 'Hemen oku, kelime kaydet, tekrar et. İlerlemeni kaydetmek için istediğin zaman giriş yap.'
              : 'Bugün öğrenmeye okumayla başla, kamerayla kelime yakala ya da videodan transcript üzerinden çalış.'}
          </Text>
          {guest ? (
            <TouchableOpacity
              style={styles.guestBanner}
              onPress={() => router.push('/auth/login')}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={colors.accent} />
              <Text style={styles.guestBannerText}>Kelimelerini bulutta sakla — ücretsiz giriş</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </FadeInView>

      {!isPro && <FreePlanBanner />}
      {!isPro && <ProUpsellBanner />}

      <FirstWinCard />

      <FadeInView delay={50}>
        <WeeklyInsightsCard
          week={stats.week}
          today={stats.today}
          total={stats.total}
          streak={stats.streak}
          goal={dailyGoal}
        />
      </FadeInView>

      <FadeInView delay={60}>
        <LevelPathCard level={userLevel} />
      </FadeInView>

      <FadeInView delay={70}>
        <DailyGoalCard today={stats.today} goal={dailyGoal} />
      </FadeInView>

      {(stats.week > 0 || stats.total >= 3) && (
        <FadeInView delay={75}>
          <TouchableOpacity
            style={styles.wrappedCard}
            onPress={() => router.push('/(tabs)/wrapped')}
            activeOpacity={0.88}
          >
            <View style={styles.wrappedIcon}>
              <Ionicons name="gift-outline" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.wrappedTitle}>Haftalık Wrapped</Text>
              <Text style={styles.wrappedSub}>Bu haftaki kelime yolculuğunu kart kart gör</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </FadeInView>
      )}

      {stats.total >= 3 && (
        <FadeInView delay={90}>
          <TouchableOpacity
            style={styles.practiceCard}
            onPress={() => router.push('/(tabs)/practice')}
            activeOpacity={0.88}
          >
            <View style={styles.practiceIcon}>
              <Ionicons name="flash-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.practiceTitle}>Hızlı Pratik</Text>
              <Text style={styles.practiceSub}>5 rastgele kelime — kart çevir, kendini test et</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </FadeInView>
      )}

      {(dueCount.due > 0 || dueCount.newWords > 0) && (
        <FadeInView delay={100}>
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
        </FadeInView>
      )}

      <FadeInView delay={140}>
      <View style={styles.actionSection}>
        <Text style={styles.sectionEyebrow}>BUGÜN BAŞLA</Text>
        <TouchableOpacity
          style={styles.featuredAction}
          onPress={() => router.push(featuredAction.route as any)}
          activeOpacity={0.88}
        >
          <View style={styles.featuredActionLeft}>
            <View style={styles.featuredActionIcon}>
              <Ionicons name={featuredAction.icon} size={18} color={colors.bg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featuredActionTitle}>{featuredAction.label}</Text>
              <Text style={styles.featuredActionSub}>Bir metin aç, kelimeye dokun, anlamını gör ve kaydet.</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </TouchableOpacity>

        <View style={styles.quickActionRow}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickActionCard}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.86}
            >
              <View style={styles.quickActionIconRow}>
                <Ionicons name={action.icon} size={16} color={colors.accent} />
                {action.pro && !isPro ? (
                  <View style={styles.proLock}>
                    <Ionicons name="lock-closed" size={8} color={colors.bg} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.quickActionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      </FadeInView>

      <View style={styles.grid}>
        {[
          { label: 'Toplam Kelime', value: stats.total, color: colors.accent },
          { label: 'Bugün Eklenen', value: stats.today, color: '#4ade80' },
          { label: 'Bu Hafta', value: stats.week, color: '#60a5fa' },
          { label: 'Öğrenildi', value: stats.mastered, color: '#e879f9' },
        ].map((s) => (
          <View key={s.label} style={styles.card}>
            <Text style={[styles.cardValue, { color: s.color }]}>{s.value}</Text>
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
          <View style={styles.wodActions}>
            <TouchableOpacity
              style={[styles.wodSaveBtn, wodSaved && styles.wodSaveBtnDone]}
              onPress={saveWordOfDay}
              disabled={wodSaved}
            >
              <Ionicons
                name={wodSaved ? 'checkmark-circle' : 'bookmark-outline'}
                size={16}
                color={wodSaved ? '#4ade80' : colors.bg}
              />
              <Text style={[styles.wodSaveText, wodSaved && styles.wodSaveTextDone]}>
                {wodSaved ? 'Kaydedildi' : 'Kaydet'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inlineAction} onPress={() => router.push('/(tabs)/words')}>
              <Text style={styles.inlineActionText}>Kelimelerim →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
        <View style={styles.secondaryGrid}>
          {secondaryActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.secondaryCard, 'accent' in action && action.accent && styles.secondaryCardAccent]}
              onPress={() => router.push(action.route as any)}
            >
              <Text style={[styles.secondaryCardText, 'accent' in action && action.accent && styles.secondaryCardTextAccent]}>
                {action.label}
              </Text>
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
              <Ionicons name="book-outline" size={16} color={colors.textMuted} style={{ marginTop: 1 }} />
              <Text style={styles.historyTitle} numberOfLines={1}>{item.title || item.url || 'Manuel metin'}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  hero: { marginBottom: 22 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.text },
  heroSub: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.accentDim,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.25)',
  },
  guestBannerText: { color: colors.accent, fontSize: 13, fontWeight: '700', flex: 1 },
  actionSection: { marginBottom: 18 },
  sectionEyebrow: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(251,146,60,0.15)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.35)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  streakFire: { fontSize: 16 },
  streakNum: { fontSize: 18, fontWeight: '800', color: '#fb923c' },
  streakLabel: { fontSize: 11, fontWeight: '700', color: '#fb923c' },
  practiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  practiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  practiceSub: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  wrappedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wrappedIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrappedTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  wrappedSub: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
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
  featuredAction: {
    backgroundColor: colors.accent,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  featuredActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  featuredActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  featuredActionTitle: { color: colors.bg, fontSize: 17, fontWeight: '800', marginBottom: 3 },
  featuredActionSub: { color: 'rgba(0,0,0,0.7)', fontSize: 12, lineHeight: 17 },
  quickActionRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 6,
  },
  quickActionIconRow: { position: 'relative' },
  proLock: {
    position: 'absolute',
    top: -4,
    right: -8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: { color: colors.text, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: { width: '47%', backgroundColor: colors.bgCard, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border },
  cardValue: { fontSize: 32, fontWeight: '800' },
  cardLabel: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  emptyState: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  emptyCta: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  emptyCtaText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  wodCard: { backgroundColor: '#0d0d0d', borderRadius: 14, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#1f1f1f' },
  wodLabel: { color: '#facc15', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  wodWord: { fontSize: 22, fontWeight: '800', color: '#f0f0f0' },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cefrText: { fontSize: 11, fontWeight: '700' },
  wodTr: { color: '#999', fontSize: 14, marginTop: 4 },
  wodActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  wodSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  wodSaveBtnDone: { backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)' },
  wodSaveText: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  wodSaveTextDone: { color: '#4ade80' },
  inlineAction: { backgroundColor: colors.accentDim, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  inlineActionText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  secondaryCardAccent: { borderColor: 'rgba(250,204,21,0.45)', backgroundColor: colors.accentDim },
  secondaryCardTextAccent: { color: colors.accent },
  section: { marginBottom: 18 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  secondaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryCardText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  historyCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10 },
  historyTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
})
