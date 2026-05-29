import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, FlatList, Alert, KeyboardAvoidingView, Platform,
  Animated, PanResponder, Modal, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../../lib/theme'
import { speak } from '../../../../lib/speech'
import {
  listCards, createCard, updateCard, deleteCard, getDeck, updateDeck,
  listVocabForImport, addCardsFromVocab,
  type FlashcardCard, type VocabSourceItem,
} from '../../../../lib/flashcards'

export default function EditDeckScreen() {
  const router = useRouter()
  const { deckId } = useLocalSearchParams<{ deckId: string }>()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  const [vocabOpen, setVocabOpen] = useState(false)

  const load = useCallback(async () => {
    if (!deckId) return
    setLoading(true)
    setError(null)
    try {
      const [d, list] = await Promise.all([getDeck(deckId), listCards(deckId)])
      if (d) {
        setTitle(d.title)
        setDescription(d.description ?? '')
      }
      setCards(list)
    } catch (e: any) {
      setError(e?.message || 'Yükleme başarısız')
    } finally {
      setLoading(false)
    }
  }, [deckId])

  useEffect(() => { void load() }, [load])

  async function handleSaveMeta() {
    if (!deckId) return
    if (!title.trim()) {
      Alert.alert('Başlık gerekli', 'Lütfen desteye bir ad ver.')
      return
    }
    setSavingMeta(true)
    try {
      await updateDeck(deckId, { title: title.trim(), description: description.trim() || null })
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message || 'Bilinmeyen hata')
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleAddCard() {
    if (!deckId) return
    const f = newFront.trim()
    const b = newBack.trim()
    if (!f || !b) {
      Alert.alert('Eksik alan', 'Hem ön yüz hem arka yüz dolu olmalı.')
      return
    }
    setAdding(true)
    try {
      const c = await createCard({ deck_id: deckId, front: f, back: b })
      setCards((arr) => [...arr, c])
      setNewFront('')
      setNewBack('')
    } catch (e: any) {
      Alert.alert('Eklenemedi', e?.message || 'Bilinmeyen hata')
    } finally {
      setAdding(false)
    }
  }

  function startEdit(card: FlashcardCard) {
    setEditingId(card.id)
    setEditFront(card.front)
    setEditBack(card.back)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditFront('')
    setEditBack('')
  }

  async function saveEdit() {
    if (!editingId) return
    if (!editFront.trim() || !editBack.trim()) {
      Alert.alert('Eksik alan', 'Hem ön hem arka yüz dolu olmalı.')
      return
    }
    try {
      const upd = await updateCard(editingId, { front: editFront.trim(), back: editBack.trim() })
      setCards((arr) => arr.map((c) => (c.id === editingId ? upd : c)))
      cancelEdit()
    } catch (e: any) {
      Alert.alert('Kaydedilemedi', e?.message || 'Bilinmeyen hata')
    }
  }

  async function handleDelete(cardId: string) {
    try {
      await deleteCard(cardId)
      setCards((arr) => arr.filter((c) => c.id !== cardId))
      if (editingId === cardId) cancelEdit()
    } catch (e: any) {
      Alert.alert('Silinemedi', e?.message || 'Bilinmeyen hata')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      </SafeAreaView>
    )
  }
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={28} color="#f87171" />
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Düzenle</Text>
        <TouchableOpacity
          onPress={handleSaveMeta}
          style={[styles.saveBtn, (savingMeta || !title.trim()) && { opacity: 0.4 }]}
          activeOpacity={0.85}
          disabled={savingMeta || !title.trim()}
        >
          {savingMeta ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <Text style={styles.saveBtnText}>Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <FlatList
          data={cards}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <View style={styles.metaBlock}>
                <Text style={styles.label}>BAŞLIK</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  style={styles.input}
                  placeholder="Deste adı"
                  placeholderTextColor={colors.textMuted}
                  maxLength={80}
                />
                <Text style={[styles.label, { marginTop: 10 }]}>AÇIKLAMA</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  style={[styles.input, { minHeight: 56 }]}
                  placeholder="Açıklama (opsiyonel)"
                  placeholderTextColor={colors.textMuted}
                  maxLength={200}
                  multiline
                />
              </View>

              <Text style={styles.sectionLabel}>YENİ KART EKLE</Text>
              <View style={styles.addCardBlock}>
                <TextInput
                  value={newFront}
                  onChangeText={setNewFront}
                  style={styles.input}
                  placeholder="Ön yüz (ör. dog)"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  value={newBack}
                  onChangeText={setNewBack}
                  style={[styles.input, { marginTop: 8 }]}
                  placeholder="Arka yüz (ör. köpek)"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity
                  onPress={handleAddCard}
                  style={[styles.addBtn, (adding || !newFront.trim() || !newBack.trim()) && { opacity: 0.5 }]}
                  activeOpacity={0.85}
                  disabled={adding || !newFront.trim() || !newBack.trim()}
                >
                  {adding ? (
                    <ActivityIndicator size="small" color={colors.bg} />
                  ) : (
                    <>
                      <Ionicons name="add" size={16} color={colors.bg} />
                      <Text style={styles.addBtnText}>Kart ekle</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setVocabOpen(true)}
                  style={styles.vocabImportBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="library-outline" size={15} color={colors.accent} />
                  <Text style={styles.vocabImportBtnText}>Kaydettiğin kelimelerden seç</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>KARTLAR ({cards.length})</Text>
              {cards.length === 0 ? (
                <View style={styles.emptyCardsBox}>
                  <Ionicons name="albums-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.emptyCardsTitle}>Henüz kart yok</Text>
                  <Text style={styles.emptyCardsDesc}>
                    Hızlı başlangıç için kaydettiğin kelimelerden seçebilirsin.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setVocabOpen(true)}
                    style={styles.emptyCardsBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="library-outline" size={15} color={colors.bg} />
                    <Text style={styles.emptyCardsBtnText}>Kelimelerden seç</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <CardRow
              card={item}
              isEditing={editingId === item.id}
              editFront={editFront}
              editBack={editBack}
              setEditFront={setEditFront}
              setEditBack={setEditBack}
              onStartEdit={() => startEdit(item)}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onDelete={() => {
                Alert.alert(
                  'Kartı sil',
                  'Bu kart silinsin mi?',
                  [
                    { text: 'Vazgeç', style: 'cancel' },
                    { text: 'Sil', style: 'destructive', onPress: () => handleDelete(item.id) },
                  ],
                )
              }}
            />
          )}
        />
      </KeyboardAvoidingView>

      <VocabPickerModal
        visible={vocabOpen}
        existingFronts={cards.map((c) => c.front)}
        onClose={() => setVocabOpen(false)}
        onAdded={async () => {
          setVocabOpen(false)
          await load()
        }}
        deckId={deckId}
      />
    </SafeAreaView>
  )
}

function VocabPickerModal({
  visible, deckId, existingFronts, onClose, onAdded,
}: {
  visible: boolean
  deckId: string | undefined
  existingFronts: string[]
  onClose: () => void
  onAdded: () => void | Promise<void>
}) {
  const [items, setItems] = useState<VocabSourceItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const existingSet = new Set(existingFronts.map((f) => f.trim().toLowerCase()))

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoadingList(true)
    setSearch('')
    setPicked(new Set())
    void (async () => {
      try {
        const list = await listVocabForImport()
        if (cancelled) return
        setItems(list)
        // Default-select words not yet in the deck
        const defaults = new Set<number>()
        list.forEach((it, i) => {
          if (!!it.translation && !existingSet.has(it.word.trim().toLowerCase())) {
            defaults.add(i)
          }
        })
        setPicked(defaults)
      } catch (e: any) {
        if (!cancelled) Alert.alert('Sözlük alınamadı', e?.message || 'Bilinmeyen hata')
      } finally {
        if (!cancelled) setLoadingList(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  function toggle(i: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const filtered = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return (
        it.word.toLowerCase().includes(q) ||
        (it.translation || '').toLowerCase().includes(q)
      )
    })

  async function handleAdd() {
    if (!deckId) return
    const chosen = items.filter((_, i) => picked.has(i))
    const withTr = chosen.filter((it) => !!it.translation)
    if (withTr.length === 0) {
      Alert.alert('Kelime seç', 'En az bir kelime seçmelisin.')
      return
    }
    setSaving(true)
    try {
      const res = await addCardsFromVocab({ deck_id: deckId, items: withTr })
      const skippedExisting = chosen.length - withTr.length
      const totalSkipped = res.skipped + skippedExisting
      Alert.alert(
        'Kartlar eklendi',
        `${res.added} kart eklendi${totalSkipped ? ` · ${totalSkipped} atlandı` : ''}.`,
      )
      await onAdded()
    } catch (e: any) {
      Alert.alert('Eklenemedi', e?.message || 'Bilinmeyen hata')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} disabled={saving}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Sözlükten seç</Text>
          <TouchableOpacity
            onPress={handleAdd}
            style={[styles.saveBtn, (saving || picked.size === 0) && { opacity: 0.4 }]}
            activeOpacity={0.85}
            disabled={saving || picked.size === 0}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.bg} />
            ) : (
              <Text style={styles.saveBtnText}>Ekle ({picked.size})</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              placeholder="Kelime veya çeviri ara"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.actionsRow}>
            <Text style={styles.countText}>
              {picked.size} / {items.length} seçili
            </Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <TouchableOpacity onPress={() => {
                const all = new Set<number>()
                items.forEach((it, i) => { if (it.translation) all.add(i) })
                setPicked(all)
              }}>
                <Text style={styles.linkBtn}>Tümü</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPicked(new Set())}>
                <Text style={styles.linkBtn}>Temizle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {loadingList ? (
          <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.accent} /></View>
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="bookmark-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Henüz kaydettiğin kelime yok</Text>
            <Text style={styles.emptyDesc}>
              Sözlükten kelime kaydet, sonra buradan kart olarak ekleyebilirsin.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 6 }}>
            {filtered.map(({ it, i }) => {
              const checked = picked.has(i)
              const already = existingSet.has(it.word.trim().toLowerCase())
              const noTr = !it.translation
              const disabled = noTr
              return (
                <TouchableOpacity
                  key={`${it.word}-${i}`}
                  style={[
                    styles.vocabRow,
                    checked && styles.vocabRowChecked,
                    disabled && { opacity: 0.45 },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => !disabled && toggle(i)}
                  disabled={disabled}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked ? <Ionicons name="checkmark" size={13} color={colors.bg} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vocabWord}>{it.word}</Text>
                    {it.translation ? (
                      <Text style={styles.vocabTr} numberOfLines={1}>{it.translation}</Text>
                    ) : (
                      <Text style={[styles.vocabTr, { color: '#fb923c' }]}>çeviri yok — atlanır</Text>
                    )}
                  </View>
                  {already ? (
                    <View style={styles.alreadyPill}>
                      <Text style={styles.alreadyPillText}>destede var</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  )
}

function CardRow({
  card, isEditing,
  editFront, editBack, setEditFront, setEditBack,
  onStartEdit, onCancelEdit, onSaveEdit, onDelete,
}: {
  card: FlashcardCard
  isEditing: boolean
  editFront: string
  editBack: string
  setEditFront: (v: string) => void
  setEditBack: (v: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onDelete: () => void
}) {
  // Swipe-left-to-delete
  const tx = useRef(new Animated.Value(0)).current
  const opacity = tx.interpolate({
    inputRange: [-120, -40, 0],
    outputRange: [1, 0.6, 0],
    extrapolate: 'clamp',
  })

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        !isEditing && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        if (g.dx < 0) tx.setValue(Math.max(g.dx, -160))
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -100) {
          Animated.timing(tx, { toValue: -120, duration: 160, useNativeDriver: true }).start(() => onDelete())
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start()
      },
    }),
  ).current

  if (isEditing) {
    return (
      <View style={styles.cardRowEditing}>
        <Text style={styles.label}>ÖN YÜZ</Text>
        <TextInput
          value={editFront}
          onChangeText={setEditFront}
          style={styles.input}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={[styles.label, { marginTop: 10 }]}>ARKA YÜZ</Text>
        <TextInput
          value={editBack}
          onChangeText={setEditBack}
          style={styles.input}
          placeholderTextColor={colors.textMuted}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity onPress={onCancelEdit} style={styles.cancelBtn} activeOpacity={0.85}>
            <Text style={styles.cancelBtnText}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSaveEdit} style={styles.saveSmallBtn} activeOpacity={0.85}>
            <Text style={styles.saveSmallBtnText}>Kaydet</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.cardRowOuter}>
      <Animated.View
        pointerEvents="none"
        style={[styles.deleteBg, { opacity }]}
      >
        <Ionicons name="trash" size={20} color="#fff" />
        <Text style={styles.deleteBgText}>Sil</Text>
      </Animated.View>
      <Animated.View
        style={[styles.cardRow, { transform: [{ translateX: tx }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.cardSpeakerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => { if (card.front) speak(card.front, { language: 'en-US' }) }}
          activeOpacity={0.7}
        >
          <Ionicons name="volume-high" size={18} color={colors.accent} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardFront}>{card.front}</Text>
          <Text style={styles.cardBack}>{card.back}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[
            styles.statusPill,
            card.status === 'known' && styles.statusKnown,
            card.status === 'unknown' && styles.statusUnknown,
          ]}>
            <Text style={[
              styles.statusPillText,
              card.status === 'known' && { color: '#4ade80' },
              card.status === 'unknown' && { color: '#f87171' },
            ]}>
              {card.status === 'known' ? 'biliyorum' : card.status === 'unknown' ? 'tekrar' : 'yeni'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={onStartEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="create-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color="#f87171" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 12,
  },
  topTitle: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '800', marginLeft: 6 },
  saveBtn: {
    backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, minWidth: 76, alignItems: 'center',
  },
  saveBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  errText: { color: colors.text, fontSize: 14, textAlign: 'center' },
  backBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  backBtnText: { color: colors.accent, fontWeight: '800' },

  metaBlock: {
    marginHorizontal: 20, marginBottom: 6, padding: 14,
    backgroundColor: colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  label: {
    color: colors.textMuted, fontSize: 11, fontWeight: '800',
    letterSpacing: 0.7, marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.text, fontSize: 14,
  },

  sectionLabel: {
    color: colors.textMuted, fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, paddingHorizontal: 20, marginTop: 16, marginBottom: 8,
  },
  addCardBlock: {
    marginHorizontal: 20, marginBottom: 4, padding: 14,
    backgroundColor: colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  addBtn: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: colors.accent, paddingVertical: 11, borderRadius: 12,
  },
  addBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },

  vocabImportBtn: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 12,
    borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentDim,
  },
  vocabImportBtnText: { color: colors.accent, fontWeight: '800', fontSize: 13 },

  modalContainer: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchInput: {
    flex: 1, color: colors.text, fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 0 : 4,
  },
  actionsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  countText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  linkBtn: { color: colors.accent, fontWeight: '700', fontSize: 12 },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 6 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  emptyDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center' },

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
  alreadyPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  alreadyPillText: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  cardRowOuter: {
    marginHorizontal: 20, marginBottom: 8,
    borderRadius: 14, overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  cardSpeakerBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.accentDim,
    borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  cardFront: { color: colors.text, fontSize: 15, fontWeight: '800' },
  cardBack: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  statusKnown: { borderColor: '#4ade80', backgroundColor: '#0f1d14' },
  statusUnknown: { borderColor: '#f87171', backgroundColor: '#1a0e0e' },
  statusPillText: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  deleteBg: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    backgroundColor: '#f87171', width: 120,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14,
  },
  deleteBgText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  cardRowEditing: {
    marginHorizontal: 20, marginBottom: 8, padding: 14,
    backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.accent,
    borderRadius: 14,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  cancelBtnText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  saveSmallBtn: {
    flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, backgroundColor: colors.accent,
  },
  saveSmallBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },

  emptyText: {
    color: colors.textMuted, fontSize: 13, paddingHorizontal: 20, marginTop: 4,
  },
  emptyCardsBox: {
    marginHorizontal: 20, marginTop: 4, padding: 18,
    backgroundColor: colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', gap: 6,
  },
  emptyCardsTitle: {
    color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 4,
  },
  emptyCardsDesc: {
    color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center',
    marginBottom: 4,
  },
  emptyCardsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 999, marginTop: 4,
  },
  emptyCardsBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },
})
