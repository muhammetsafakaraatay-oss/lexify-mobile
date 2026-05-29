import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { getDueCount, listUniqueSavedWords } from '../../lib/data'
import { usePremium } from '../../contexts/SubscriptionContext'
import { FREE_LIMITS } from '../../lib/plan'
import { getTodayQuizSessions, getTodayReverseQuizAttempts } from '../../lib/usage'

export default function StudyScreen() {
  const router = useRouter()
  const { isPro } = usePremium()
  const [loading, setLoading] = useState(true)
  const [wordCount, setWordCount] = useState(0)
  const [due, setDue] = useState({ due: 0, newWords: 0, learning: 0 })
  const [quizToday, setQuizToday] = useState(0)
  const [reverseToday, setReverseToday] = useState(0)

  const load = useCallback(async () => {
    const [words, dueCount, sessions, reverseAttempts] = await Promise.all([
      listUniqueSavedWords(),
      getDueCount(),
      getTodayQuizSessions(),
      getTodayReverseQuizAttempts(),
    ])
    setWordCount(words.length)
    setDue(dueCount)
    setQuizToday(sessions)
    setReverseToday(reverseAttempts)
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const studyActions = [
    {
      id: 'flashcards',
      icon: 'layers-outline' as const,
      title: 'Flashcard',
      desc: due.due > 0 ? `${due.due} kelime review bekliyor` : 'SM-2 ile aralıklı tekrar',
      route: '/(tabs)/flashcards',
      accent: true,
      disabled: wordCount === 0,
    },
    {
      id: 'quiz',
      icon: 'game-controller-outline' as const,
      title: 'Quiz',
      desc: isPro
        ? 'Eşleştirme ile kelimeleri pekiştir'
        : quizToday >= FREE_LIMITS.maxQuizSessionsPerDay
          ? 'Bugünkü ücretsiz oturum bitti'
          : 'Günde 1 ücretsiz oturum',
      route: '/(tabs)/quiz',
      disabled: wordCount < 4,
    },
    {
      id: 'reverse',
      icon: 'create-outline' as const,
      title: 'Çeviri Modu',
      desc: isPro
        ? 'Türkçe gör, İngilizce üret, AI ile puan al'
        : reverseToday >= FREE_LIMITS.maxReverseQuizAttemptsPerDay
          ? 'Bugünkü ücretsiz çeviri hakkı bitti'
          : `Günde ${FREE_LIMITS.maxReverseQuizAttemptsPerDay} ücretsiz deneme`,
      route: '/(tabs)/reverse-quiz',
      disabled: wordCount < 3,
    },
    {
      id: 'practice',
      icon: 'flash-outline' as const,
      title: 'Hızlı Pratik',
      desc: '5 rastgele kelime — kart çevir',
      route: '/(tabs)/practice',
      disabled: wordCount === 0,
    },
  ]

  const learnActions = [
    {
      id: 'story',
      icon: 'sparkles-outline' as const,
      title: 'Mikro Hikâye',
      desc: 'Kaydettiğin kelimelerle haftalık mini hikâye',
      route: '/(tabs)/story',
      pro: false,
    },
    {
      id: 'voice',
      icon: 'mic-outline' as const,
      title: 'Sesli Pratik',
      desc: isPro ? 'Kendi sesinle konus, transcript ve AI feedback al' : 'Haftada 1 ucretsiz sesli deneme',
      route: '/(tabs)/sesli',
      pro: false,
    },
    {
      id: 'audio-text',
      icon: 'musical-notes-outline' as const,
      title: 'Şarkı / Podcast',
      desc: 'Sözleri veya transcript’i reader içinde çalış',
      route: '/(tabs)/audio-text',
      pro: false,
    },
    {
      id: 'writing',
      icon: 'create-outline' as const,
      title: 'Writing (IELTS)',
      desc: 'IELTS tarzı promptlar, süreli yazma + otomatik kaydet',
      route: '/(tabs)/writing',
      pro: false,
    },
    {
      id: 'camera',
      icon: 'camera-outline' as const,
      title: 'Kamera OCR',
      desc: 'Kitap veya ekrandan metin tara',
      route: '/(tabs)/camera',
      pro: true,
    },
    {
      id: 'video',
      icon: 'play-circle-outline' as const,
      title: 'Video Transcript',
      desc: 'YouTube üzerinden kelime öğren',
      route: '/(tabs)/video',
      pro: true,
    },
    {
      id: 'duel',
      icon: 'trophy-outline' as const,
      title: 'Düello',
      desc: 'Arkadaşına mini kelime meydan okuması gönder',
      route: '/(tabs)/duel',
      pro: false,
    },
  ]

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Çalış</Text>
        <Text style={styles.subtitle}>
          Kaydettiğin kelimeleri tekrar et. Okuma döngüsünü burada pekiştirirsin.
        </Text>

        {wordCount === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="school-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Henüz çalışılacak kelime yok</Text>
            <Text style={styles.emptyText}>
              Önce Oku veya Keşfet’ten kelime kaydet; flashcard ve quiz burada açılır.
            </Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(tabs)/oku')}>
              <Text style={styles.emptyCtaText}>Okumaya Başla</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {(due.due > 0 || due.newWords > 0) && (
              <TouchableOpacity
                style={styles.dueHero}
                onPress={() => router.push('/(tabs)/flashcards')}
                activeOpacity={0.9}
              >
                <View>
                  <Text style={styles.dueEyebrow}>BUGÜN GÖZDEN GEÇİR</Text>
                  <Text style={styles.dueTitle}>
                    {due.due > 0 ? `${due.due} review` : `${due.newWords} yeni kelime`}
                  </Text>
                  <Text style={styles.dueSub}>
                    {due.learning} öğreniliyor · {wordCount} toplam kelime
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={36} color={colors.bg} />
              </TouchableOpacity>
            )}

            <Text style={styles.sectionLabel}>TEKRAR ET</Text>
            <View style={styles.cardGrid}>
              {studyActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.actionCard,
                    action.accent && styles.actionCardAccent,
                    action.disabled && styles.actionCardDisabled,
                  ]}
                  onPress={() => router.push(action.route as any)}
                  disabled={action.disabled}
                  activeOpacity={0.88}
                >
                  <View style={[styles.actionIcon, action.accent && styles.actionIconAccent]}>
                    <Ionicons
                      name={action.icon}
                      size={22}
                      color={action.accent ? colors.bg : colors.accent}
                    />
                  </View>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDesc} numberOfLines={2}>{action.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>İÇERİKTEN ÖĞREN</Text>
        <View style={styles.learnList}>
          {learnActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.learnRow}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.88}
            >
              <View style={styles.learnIcon}>
                <Ionicons name={action.icon} size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.learnTitleRow}>
                  <Text style={styles.learnTitle}>{action.title}</Text>
                  {action.pro && !isPro ? (
                    <View style={styles.proPill}>
                      <Text style={styles.proPillText}>PRO</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.learnDesc}>{action.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {!isPro && wordCount > 0 ? (
          <TouchableOpacity style={styles.upsell} onPress={() => router.push('/paywall')}>
            <Ionicons name="diamond-outline" size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.upsellTitle}>Pro ile sınırsız çalış</Text>
              <Text style={styles.upsellSub}>
                {FREE_LIMITS.maxSavedWords} kelime · günde {FREE_LIMITS.maxSavesPerDay} kayıt limiti kalkar
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 6 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 10,
    marginTop: 8,
  },
  dueHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    gap: 12,
  },
  dueEyebrow: { color: 'rgba(0,0,0,0.55)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  dueTitle: { color: colors.bg, fontSize: 24, fontWeight: '800', marginTop: 4 },
  dueSub: { color: 'rgba(0,0,0,0.65)', fontSize: 12, marginTop: 4, fontWeight: '600' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  actionCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 130,
  },
  actionCardAccent: { borderColor: 'rgba(250,204,21,0.35)', backgroundColor: colors.accentDim },
  actionCardDisabled: { opacity: 0.45 },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionIconAccent: { backgroundColor: colors.accent },
  actionTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  actionDesc: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  learnList: { gap: 8, marginBottom: 16 },
  learnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  learnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  learnTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  proPill: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proPillText: { color: colors.bg, fontSize: 9, fontWeight: '800' },
  learnDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    gap: 10,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyCta: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyCtaText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.28)',
  },
  upsellTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  upsellSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
})
