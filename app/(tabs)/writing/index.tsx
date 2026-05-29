// Lexify · Writing — drafts list
//
// Shows a header with the user's writing stats, a primary "New writing" CTA,
// and a list of in-progress drafts + completed pieces grouped together.

import React, { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import {
  listWritingTasks,
  deleteWritingTask,
  WritingTask,
  WritingAuthRequiredError,
} from '../../../lib/writing'
import { enableGuestMode } from '../../../lib/guest'
import {
  PROMPT_TYPE_LABELS,
  PROMPT_CATEGORY_LABELS,
} from '../../../lib/writingPrompts'

type Phase = 'loading' | 'ready' | 'error' | 'noauth'

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000
    if (diff < 60) return 'şimdi'
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`
    if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} gün önce`
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r}s`
  return `${m}d ${r}s`
}

export default function WritingIndexScreen() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [tasks, setTasks] = useState<WritingTask[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [errMsg, setErrMsg] = useState<string>('')

  const load = useCallback(async () => {
    try {
      const list = await listWritingTasks()
      setTasks(list)
      setPhase('ready')
      setErrMsg('')
    } catch (e: any) {
      if (e instanceof WritingAuthRequiredError) {
        setPhase('noauth')
        return
      }
      setErrMsg(e?.message || 'Bir sorun oluştu.')
      setPhase('error')
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      setPhase('loading')
      void load()
    }, [load]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const handleDelete = useCallback((task: WritingTask) => {
    Alert.alert(
      'Taslağı sil?',
      task.prompt_title,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWritingTask(task.id)
              setTasks((prev) => prev.filter((t) => t.id !== task.id))
            } catch (e: any) {
              Alert.alert('Hata', e?.message || 'Silinemedi.')
            }
          },
        },
      ],
      { cancelable: true },
    )
  }, [])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  // ── No auth ───────────────────────────────────────────────────────────────
  if (phase === 'noauth') {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Giriş gerekli</Text>
          <Text style={styles.emptyText}>
            Taslakları cihazda yerel saklamak için "Misafir olarak devam et"
            seçeneğini kullanabilirsin. Hesabınla senkronlamak istersen giriş yap.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/auth/login' as any)}
          >
            <Text style={styles.primaryBtnText}>Giriş yap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={async () => { await enableGuestMode(); setPhase('loading'); void load() }}
          >
            <Text style={styles.secondaryBtnText}>Misafir olarak devam et</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={44} color="#f87171" />
          <Text style={styles.emptyTitle}>Yüklenemedi</Text>
          <Text style={styles.emptyText}>{errMsg}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setPhase('loading'); void load() }}>
            <Text style={styles.primaryBtnText}>Tekrar dene</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={async () => { await enableGuestMode(); setPhase('loading'); void load() }}
          >
            <Text style={styles.secondaryBtnText}>Misafir modunda dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const drafts = tasks.filter((t) => t.status === 'draft')
  const completed = tasks.filter((t) => t.status === 'completed')
  const totalWords = completed.reduce((sum, t) => sum + (t.word_count || 0), 0)

  return (
    <SafeAreaView style={styles.container}>
      <Header onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={styles.title}>Writing</Text>
        <Text style={styles.subtitle}>
          IELTS tarzı yazma görevleri. Bir prompt seç, süreni başlat, yaz ve kaydet.
        </Text>

        <View style={styles.statsRow}>
          <Stat label="Taslak" value={String(drafts.length)} icon="document-text-outline" />
          <Stat label="Tamamlanan" value={String(completed.length)} icon="checkmark-done-outline" />
          <Stat label="Toplam kelime" value={totalWords.toLocaleString('tr-TR')} icon="sparkles-outline" />
        </View>

        <TouchableOpacity
          style={styles.heroBtn}
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/writing/prompts' as any)}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="create" size={22} color={colors.bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Yeni Yazı Başlat</Text>
            <Text style={styles.heroSub}>Task 1 / Task 2 promptlarından birini seç</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.bg} />
        </TouchableOpacity>

        {drafts.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>DEVAM EDENLER</Text>
            <View style={styles.list}>
              {drafts.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onPress={() => router.push(`/(tabs)/writing/${t.id}` as any)}
                  onLongPress={() => handleDelete(t)}
                />
              ))}
            </View>
          </>
        )}

        {completed.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>TAMAMLANANLAR</Text>
            <View style={styles.list}>
              {completed.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onPress={() => router.push(`/(tabs)/writing/feedback/${t.id}` as any)}
                  onLongPress={() => handleDelete(t)}
                />
              ))}
            </View>
          </>
        )}

        {drafts.length === 0 && completed.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="leaf-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitleSmall}>Henüz hiç yazı yok</Text>
            <Text style={styles.emptyTextSmall}>
              Üstteki butona basıp ilk yazına başla. IELTS tarzı 50+ prompt seni bekliyor.
            </Text>
          </View>
        )}

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={18} color={colors.accent} />
          <Text style={styles.tipText}>
            İpucu: Bir taslağa uzun basarak silebilirsin. Yazılar sürene göre puanlanmaz —
            önemli olan yazmayı bırakmamak.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Components ───────────────────────────────────────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.headerBack}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Writing</Text>
      <View style={{ width: 22 }} />
    </View>
  )
}

function Stat({ label, value, icon }: {
  label: string
  value: string
  icon: keyof typeof Ionicons.glyphMap
}) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function TaskRow({
  task, onPress, onLongPress,
}: {
  task: WritingTask
  onPress: () => void
  onLongPress: () => void
}) {
  const wc = task.word_count
  const tgt = task.target_words
  const pct = Math.min(1, tgt > 0 ? wc / tgt : 0)
  const isDone = task.status === 'completed'
  const typeShort = PROMPT_TYPE_LABELS[task.prompt_type]?.short ?? task.prompt_type
  const category = PROMPT_CATEGORY_LABELS[task.prompt_category as keyof typeof PROMPT_CATEGORY_LABELS] || task.prompt_category

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.88}
    >
      <View style={styles.rowHeader}>
        <View style={styles.typePill}>
          <Text style={styles.typePillText}>{typeShort}</Text>
        </View>
        <Text style={styles.rowMeta}>{category}</Text>
        <Text style={styles.rowDot}>·</Text>
        <Text style={styles.rowMeta}>{fmtDate(task.updated_at)}</Text>
        {isDone && (
          <View style={styles.donePill}>
            <Ionicons name="checkmark" size={11} color={colors.bg} />
            <Text style={styles.donePillText}>Tamam</Text>
          </View>
        )}
      </View>

      <Text style={styles.rowTitle} numberOfLines={2}>
        {task.title?.trim() ? task.title : task.prompt_title}
      </Text>

      {task.content?.trim().length > 0 && (
        <Text style={styles.rowSnippet} numberOfLines={2}>
          {task.content.trim()}
        </Text>
      )}

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: isDone ? '#4ade80' : colors.accent }]} />
      </View>

      <View style={styles.rowFooter}>
        <Text style={styles.rowFooterText}>
          {wc} / {tgt} kelime
        </Text>
        <Text style={styles.rowFooterText}>
          ⏱ {fmtDuration(task.duration_seconds)}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, gap: 8,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8,
  },
  headerBack: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },

  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 18 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: 'flex-start', gap: 2,
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.accent, borderRadius: 16, padding: 16,
    marginBottom: 20,
  },
  heroIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  heroTitle: { color: colors.bg, fontSize: 16, fontWeight: '900' },
  heroSub: { color: 'rgba(0,0,0,0.65)', fontSize: 12, fontWeight: '600', marginTop: 2 },

  sectionLabel: {
    color: colors.textDim, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.1, marginBottom: 8, marginTop: 6,
  },

  list: { gap: 10, marginBottom: 8 },
  row: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    padding: 14, gap: 6,
  },
  rowHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap',
  },
  typePill: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999,
  },
  typePillText: {
    color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.4,
  },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#4ade80', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
    marginLeft: 4,
  },
  donePillText: { color: colors.bg, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  rowMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  rowDot: { color: colors.textDim, fontSize: 11 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  rowSnippet: { color: colors.textDim, fontSize: 12, lineHeight: 17 },

  progressBar: {
    height: 5, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden', marginTop: 4,
  },
  progressFill: { height: 5, borderRadius: 3 },
  rowFooter: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 4,
  },
  rowFooterText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  emptyBox: {
    alignItems: 'center', backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    paddingVertical: 28, paddingHorizontal: 24, gap: 6, marginBottom: 16,
  },
  emptyTitle: {
    color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8,
  },
  emptyTitleSmall: {
    color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 6,
  },
  emptyText: {
    color: colors.textMuted, fontSize: 13, lineHeight: 19,
    textAlign: 'center', marginTop: 4, marginBottom: 14,
  },
  emptyTextSmall: {
    color: colors.textMuted, fontSize: 12, lineHeight: 17,
    textAlign: 'center',
  },

  primaryBtn: {
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 999,
  },
  primaryBtnText: { color: colors.bg, fontWeight: '900', fontSize: 14 },
  secondaryBtn: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999, marginTop: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },

  tipCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 12, marginTop: 8,
  },
  tipText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
})
