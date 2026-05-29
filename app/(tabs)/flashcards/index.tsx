import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import {
  listDecks, createDeck, importFromVocab, listVocabForImport,
  NotSignedInError,
  type DeckWithProgress, type VocabSourceItem,
} from '../../../lib/flashcards'

type CreateMode = 'manual' | 'vocab'

export default function FlashcardsHome() {
  const router = useRouter()
  const [decks, setDecks] = useState<DeckWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const [creatorOpen, setCreatorOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNeedsAuth(false)
    try {
      const rows = await listDecks()
      setDecks(rows)
    } catch (e: any) {
      if (e instanceof NotSignedInError) {
        setNeedsAuth(true)
      } else {
        setError(e?.message || 'Listeleme başarısız')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  function renderDeck({ item }: { item: DeckWithProgress }) {
    const p = item.progress
    const pct = p.percent
    return (
      <TouchableOpacity
        style={styles.deckCard}
        activeOpacity={0.86}
        onPress={() => router.push(`/flashcards/${item.id}`)}
      >
        <View style={styles.deckTopRow}>
          <Text style={styles.deckTitle} numberOfLines={1}>{item.title}</Text>
          {item.source === 'vocab' ? (
            <View style={styles.sourcePill}>
              <Ionicons name="bookmarks-outline" size={10} color={colors.accent} />
              <Text style={styles.sourcePillText}>Sözlükten</Text>
            </View>
          ) : null}
        </View>

        {item.description ? (
          <Text style={styles.deckDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.deckStatsRow}>
          <View style={styles.deckStat}>
            <Text style={styles.deckStatVal}>{p.total}</Text>
            <Text style={styles.deckStatLab}>kart</Text>
          </View>
          <View style={styles.deckStat}>
            <Text style={[styles.deckStatVal, { color: '#4ade80' }]}>{p.known}</Text>
            <Text style={styles.deckStatLab}>biliyorum</Text>
          </View>
          <View style={styles.deckStat}>
            <Text style={[styles.deckStatVal, { color: '#f87171' }]}>{p.unknown}</Text>
            <Text style={styles.deckStatLab}>tekrar</Text>
          </View>
          <View style={styles.deckStat}>
            <Text style={[styles.deckStatVal, { color: colors.accent }]}>{pct}%</Text>
            <Text style={styles.deckStatLab}>ilerleme</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Flashcards</Text>
        <TouchableOpacity
          onPress={() => setCreatorOpen(true)}
          style={styles.newBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={colors.bg} />
          <Text style={styles.newBtnText}>Yeni</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : needsAuth ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>Giriş gerekli</Text>
          <Text style={styles.emptyDesc}>
            Flashcard'ları kullanmak için hesabına giriş yap. Desteler hesabına bağlı olarak buluta kaydedilir.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/profile')}
            style={styles.emptyCta}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={16} color={colors.bg} />
            <Text style={styles.emptyCtaText}>Profile git</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={32} color="#f87171" />
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : decks.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums-outline" size={36} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>Henüz deste yok</Text>
          <Text style={styles.emptyDesc}>
            Quizlet tarzı kartlarla çalışmak için ilk desteni oluştur.
          </Text>
          <TouchableOpacity
            onPress={() => setCreatorOpen(true)}
            style={styles.emptyCta}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color={colors.bg} />
            <Text style={styles.emptyCtaText}>Deste oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(d) => d.id}
          renderItem={renderDeck}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}
        />
      )}

      <DeckCreator
        visible={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        onCreated={(deckId) => {
          setCreatorOpen(false)
          router.push(`/flashcards/${deckId}`)
        }}
      />
    </SafeAreaView>
  )
}

function DeckCreator({
  visible, onClose, onCreated,
}: {
  visible: boolean
  onClose: () => void
  onCreated: (deckId: string) => void
}) {
  const [mode, setMode] = useState<CreateMode>('manual')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Vocab import state
  const [vocab, setVocab] = useState<VocabSourceItem[]>([])
  const [vocabLoading, setVocabLoading] = useState(false)
  const [pickedIdx, setPickedIdx] = useState<Set<number>>(new Set())
  const [vocabLoaded, setVocabLoaded] = useState(false)

  function reset() {
    setMode('manual')
    setTitle('')
    setDescription('')
    setVocab([])
    setPickedIdx(new Set())
    setVocabLoaded(false)
  }

  function close() {
    if (saving) return
    reset()
    onClose()
  }

  async function ensureVocab() {
    if (vocabLoaded) return
    setVocabLoading(true)
    try {
      const items = await listVocabForImport()
      setVocab(items)
      setPickedIdx(new Set(items.map((_, i) => i)))
      setVocabLoaded(true)
    } catch (e: any) {
      Alert.alert('Sözlük alınamadı', e?.message || 'Bilinmeyen hata')
    } finally {
      setVocabLoading(false)
    }
  }

  function togglePick(i: number) {
    setPickedIdx((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert('Başlık gerekli', 'Lütfen desteye bir ad ver.')
      return
    }
    setSaving(true)
    try {
      if (mode === 'manual') {
        const d = await createDeck({
          title: title.trim(),
          description: description.trim() || null,
          source: 'manual',
        })
        onCreated(d.id)
      } else {
        const picked = vocab.filter((_, i) => pickedIdx.has(i))
        if (picked.length === 0) {
          Alert.alert('Kelime seç', 'En az bir kelime seçmelisin.')
          setSaving(false)
          return
        }
        const d = await importFromVocab({
          title: title.trim(),
          description: description.trim() || null,
          items: picked,
        })
        onCreated(d.id)
      }
      reset()
    } catch (e: any) {
      Alert.alert('Oluşturulamadı', e?.message || 'Bilinmeyen hata')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.topBar}>
            <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Yeni Deste</Text>
            <TouchableOpacity
              onPress={handleCreate}
              style={[styles.newBtn, (!title.trim() || saving) && { opacity: 0.4 }]}
              activeOpacity={0.85}
              disabled={!title.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Text style={styles.newBtnText}>Oluştur</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={styles.tabsRow}>
              <TouchableOpacity
                onPress={() => setMode('manual')}
                style={[styles.tabBtn, mode === 'manual' && styles.tabBtnActive]}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={mode === 'manual' ? colors.bg : colors.text}
                />
                <Text style={[styles.tabBtnText, mode === 'manual' && styles.tabBtnTextActive]}>
                  Boş deste
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setMode('vocab')
                  await ensureVocab()
                }}
                style={[styles.tabBtn, mode === 'vocab' && styles.tabBtnActive]}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="library-outline"
                  size={16}
                  color={mode === 'vocab' ? colors.bg : colors.text}
                />
                <Text style={[styles.tabBtnText, mode === 'vocab' && styles.tabBtnTextActive]}>
                  Sözlükten al
                </Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text style={styles.label}>BAŞLIK</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="ör. İş İngilizcesi · Hafta 1"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                maxLength={80}
              />
            </View>

            <View>
              <Text style={styles.label}>AÇIKLAMA (opsiyonel)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Bu destenin konusu / kapsamı"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { minHeight: 56 }]}
                maxLength={200}
                multiline
              />
            </View>

            {mode === 'vocab' ? (
              <View>
                <View style={styles.vocabHeader}>
                  <Text style={styles.label}>KELİMELER ({pickedIdx.size}/{vocab.length})</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => setPickedIdx(new Set(vocab.map((_, i) => i)))}>
                      <Text style={styles.linkBtn}>Tümü</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setPickedIdx(new Set())}>
                      <Text style={styles.linkBtn}>Temizle</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {vocabLoading ? (
                  <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
                ) : vocab.length === 0 ? (
                  <Text style={styles.emptyDesc}>Çevirisi olan kayıtlı kelimen yok.</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    {vocab.map((v, i) => {
                      const checked = pickedIdx.has(i)
                      return (
                        <TouchableOpacity
                          key={`${v.word}-${i}`}
                          style={[styles.vocabRow, checked && styles.vocabRowChecked]}
                          activeOpacity={0.85}
                          onPress={() => togglePick(i)}
                        >
                          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                            {checked ? <Ionicons name="checkmark" size={13} color={colors.bg} /> : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.vocabWord}>{v.word}</Text>
                            {v.translation ? (
                              <Text style={styles.vocabTr} numberOfLines={1}>{v.translation}</Text>
                            ) : (
                              <Text style={[styles.vocabTr, { color: '#f87171' }]}>çeviri yok</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 12,
  },
  topTitle: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800', marginLeft: 6 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, minWidth: 76, justifyContent: 'center',
  },
  newBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  errText: { color: colors.text, textAlign: 'center', fontSize: 14 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  retryBtnText: { color: colors.accent, fontWeight: '800' },
  emptyIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  emptyDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 999, marginTop: 10,
  },
  emptyCtaText: { color: colors.bg, fontWeight: '800', fontSize: 14 },

  deckCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, padding: 16, gap: 10,
  },
  deckTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deckTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '800' },
  sourcePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent,
  },
  sourcePillText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  deckDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  deckStatsRow: { flexDirection: 'row', gap: 14, marginTop: 2 },
  deckStat: { minWidth: 50 },
  deckStatVal: { color: colors.text, fontSize: 18, fontWeight: '900' },
  deckStatLab: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 1, letterSpacing: 0.4 },
  progressTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },

  tabsRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 11, borderRadius: 12,
  },
  tabBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  tabBtnTextActive: { color: colors.bg },

  label: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    color: colors.text, fontSize: 15,
  },
  linkBtn: { color: colors.accent, fontWeight: '700', fontSize: 12 },

  vocabHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  vocabRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
  },
  vocabRowChecked: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  vocabWord: { color: colors.text, fontSize: 14, fontWeight: '700' },
  vocabTr: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
})
