// Lexify · Writing — Prompt picker
//
// Filters by task type (deneme / mektup / grafik / serbest), search box,
// and a random "Şanslı seçim" button. Tapping a card creates a Supabase
// draft (or guest draft) and routes to the editor.

import React, { useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import {
  WRITING_PROMPTS,
  WritingPrompt,
  PromptType,
  PROMPT_TYPE_LABELS,
  PROMPT_CATEGORY_LABELS,
  PROMPT_DIFFICULTY_LABELS,
  getRandomPrompt,
} from '../../../lib/writingPrompts'
import { createWritingDraft, WritingAuthRequiredError } from '../../../lib/writing'

type Filter = 'all' | PromptType

const FILTERS: { id: Filter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all',          label: 'Hepsi',    icon: 'apps-outline' },
  { id: 'task2_essay',  label: 'Deneme',   icon: 'reader-outline' },
  { id: 'task1_letter', label: 'Mektup',   icon: 'mail-outline' },
  { id: 'task1_chart',  label: 'Grafik',   icon: 'bar-chart-outline' },
  { id: 'free',         label: 'Serbest',  icon: 'sparkles-outline' },
]

function diffColor(d: WritingPrompt['difficulty']): string {
  if (d === 'easy') return '#4ade80'
  if (d === 'medium') return '#facc15'
  return '#f87171'
}

export default function WritingPromptsScreen() {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const byType = filter === 'all'
      ? WRITING_PROMPTS
      : WRITING_PROMPTS.filter((p) => p.type === filter)

    const q = query.trim().toLowerCase()
    if (!q) return byType
    return byType.filter((p) => {
      return (
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        PROMPT_CATEGORY_LABELS[p.category].toLowerCase().includes(q)
      )
    })
  }, [filter, query])

  const handlePick = async (prompt: WritingPrompt) => {
    if (creating) return
    setCreating(true)
    try {
      const draft = await createWritingDraft(prompt)
      router.replace(`/(tabs)/writing/${draft.id}` as any)
    } catch (e: any) {
      if (e instanceof WritingAuthRequiredError) {
        Alert.alert(
          'Giriş gerekli',
          'Yazma taslaklarını kaydedebilmek için giriş yapman gerek.',
          [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Giriş yap', onPress: () => router.push('/auth/login' as any) },
          ],
        )
      } else {
        Alert.alert('Hata', e?.message || 'Taslak oluşturulamadı.')
      }
    } finally {
      setCreating(false)
    }
  }

  const handleRandom = async () => {
    const pool = filter === 'all' ? undefined : filter
    const p = getRandomPrompt(pool)
    await handlePick(p)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prompt Seç</Text>
        <TouchableOpacity onPress={handleRandom} hitSlop={8} disabled={creating}>
          <Ionicons name="shuffle" size={20} color={creating ? colors.textDim : colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Konu, kategori veya kelime ara..."
          placeholderTextColor={colors.textDim}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.85}
            >
              <Ionicons
                name={f.icon}
                size={13}
                color={active ? colors.bg : colors.textMuted}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Sonuç yok</Text>
            <Text style={styles.emptyText}>Aramayı temizleyip farklı bir kelime dene.</Text>
          </View>
        ) : (
          filtered.map((p) => (
            <PromptCard key={p.id} prompt={p} onPress={() => handlePick(p)} />
          ))
        )}
      </ScrollView>

      {creating && (
        <View style={styles.busyOverlay} pointerEvents="auto">
          <View style={styles.busyCard}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.busyText}>Taslak hazırlanıyor...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

function PromptCard({ prompt, onPress }: { prompt: WritingPrompt; onPress: () => void }) {
  const typeShort = PROMPT_TYPE_LABELS[prompt.type].short
  const category = PROMPT_CATEGORY_LABELS[prompt.category]

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.typePill}>
          <Text style={styles.typePillText}>{typeShort}</Text>
        </View>
        <View style={styles.cardHeaderMeta}>
          <View style={[styles.diffDot, { backgroundColor: diffColor(prompt.difficulty) }]} />
          <Text style={styles.cardMeta}>{PROMPT_DIFFICULTY_LABELS[prompt.difficulty]}</Text>
          <Text style={styles.cardDot}>·</Text>
          <Text style={styles.cardMeta}>{category}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{prompt.title}</Text>
      <Text style={styles.cardBody} numberOfLines={4}>
        {prompt.body}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.footerChip}>
          <Ionicons name="text-outline" size={12} color={colors.textMuted} />
          <Text style={styles.footerChipText}>{prompt.targetWords} kelime</Text>
        </View>
        <View style={styles.footerChip}>
          <Ionicons name="timer-outline" size={12} color={colors.textMuted} />
          <Text style={styles.footerChipText}>{prompt.suggestedMinutes} dk</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Ionicons name="arrow-forward" size={16} color={colors.accent} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8,
  },
  headerBack: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },

  searchBox: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1, color: colors.text, fontSize: 14, padding: 0,
  },

  chipsRow: {
    paddingHorizontal: 16, paddingBottom: 12, gap: 8,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.bg },

  list: { padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    padding: 14, gap: 8,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, flexWrap: 'wrap',
  },
  typePill: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  typePillText: {
    color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.4,
  },
  cardHeaderMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  cardMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  cardDot: { color: colors.textDim, fontSize: 11 },
  diffDot: { width: 6, height: 6, borderRadius: 3 },

  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  cardBody: { color: colors.textDim, fontSize: 12, lineHeight: 18 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
  },
  footerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  footerChipText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  emptyBox: {
    alignItems: 'center', paddingVertical: 36, gap: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },

  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  busyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14,
  },
  busyText: { color: colors.text, fontSize: 13, fontWeight: '700' },
})
