import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Modal, TextInput,
  Pressable, ScrollView, Dimensions,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import {
  createCollection as createCollectionRecord,
  deleteCollectionById,
  listCollections,
  listWordsForCollection,
  SavedWord,
} from '../../lib/data'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { speak } from '../../lib/speech'

const SW = Dimensions.get('window').width
const GAP = 10
const TILE = (SW - 40 - GAP) / 2

const DEFAULT_COLLECTIONS = [
  { id: 'favorites', name: 'Favoriler', emoji: '⭐', color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
  { id: 'later', name: 'Daha Sonra', emoji: '🔖', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  { id: 'hard', name: 'Zor Kelimeler', emoji: '🔥', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
]

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📁')
  const [selected, setSelected] = useState<any>(null)
  const [words, setWords] = useState<SavedWord[]>([])
  const [wordsLoading, setWordsLoading] = useState(false)
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({})

  useFocusEffect(useCallback(() => { loadCollections() }, []))

  async function loadCollections() {
    setLoading(true)
    const cols = await listCollections()
    setCollections(cols)

    const counts: Record<string, number> = {}
    await Promise.all(
      cols.map(async (c) => {
        try {
          const ws = await listWordsForCollection(c.id)
          counts[c.id] = ws.length
        } catch { counts[c.id] = 0 }
      })
    )
    DEFAULT_COLLECTIONS.forEach(c => { counts[c.id] = 0 })
    setWordCounts(counts)
    setLoading(false)
  }

  async function createCollection() {
    if (!newName.trim()) return
    const data = await createCollectionRecord(newName.trim())
    if (data) {
      const updated = [...collections, data]
      setCollections(updated)
      setWordCounts(p => ({ ...p, [data.id]: 0 }))
    }
    setNewName('')
    setNewEmoji('📁')
    setModalVisible(false)
  }

  async function deleteCollection(id: string) {
    await deleteCollectionById(id)
    setCollections(p => p.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function openCollection(col: any) {
    setSelected(col)
    setWordsLoading(true)
    setWords(await listWordsForCollection(col.id))
    setWordsLoading(false)
  }

  const isDefault = (id: string) => ['favorites', 'later', 'hard'].includes(id)
  const allCollections = [...DEFAULT_COLLECTIONS, ...collections]

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────
  if (selected) {
    const defData = DEFAULT_COLLECTIONS.find(d => d.id === selected.id)
    const accentColor = defData?.color || colors.accent

    return (
      <SafeAreaView style={S.container}>
        {/* Header */}
        <View style={S.detailHeader}>
          <TouchableOpacity onPress={() => setSelected(null)} style={S.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={S.detailHeaderMid}>
            <Text style={S.detailEmoji}>{selected.emoji || '📁'}</Text>
            <View>
              <Text style={S.detailTitle}>{selected.name}</Text>
              <Text style={S.detailCount}>{words.length} kelime</Text>
            </View>
          </View>
        </View>

        {/* Accent bar */}
        <View style={[S.detailAccentBar, { backgroundColor: accentColor }]} />

        {wordsLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} size="large" />
        ) : words.length === 0 ? (
          <View style={S.empty}>
            <View style={[S.emptyIcon, { backgroundColor: accentColor + '15' }]}>
              <Text style={{ fontSize: 32 }}>{selected.emoji || '📁'}</Text>
            </View>
            <Text style={S.emptyTitle}>Bu liste boş</Text>
            <Text style={S.emptySub}>Kelimelerimi ekranından kelimeleri listeye ekleyebilirsin</Text>
          </View>
        ) : (
          <FlatList
            data={words}
            keyExtractor={(item, idx) => `${item.id}-${idx}`}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => (
              <View style={S.wordCard}>
                <View style={[S.wordAccentBar, { backgroundColor: accentColor }]} />
                <View style={S.wordBody}>
                  <View style={S.wordTop}>
                    <View style={{ flex: 1 }}>
                      <View style={S.wordTitleRow}>
                        <Text style={S.wordText}>{item.word}</Text>
                        {item.cefr && (
                          <View style={[S.cefrBadge, { borderColor: cefrColors[item.cefr] || colors.border }]}>
                            <Text style={[S.cefrText, { color: cefrColors[item.cefr] || colors.textMuted }]}>{item.cefr}</Text>
                          </View>
                        )}
                      </View>
                      {item.ipa ? <Text style={S.ipa}>/{item.ipa}/</Text> : null}
                      <Text style={S.wordTr}>{item.translation}</Text>
                    </View>
                    <TouchableOpacity style={S.speakBtn} onPress={() => speak(item.word, { rate: 0.8 })}>
                      <Ionicons name="volume-medium-outline" size={19} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {item.context ? <Text style={S.context} numberOfLines={2}>{item.context}</Text> : null}
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <View>
          <Text style={S.eyebrow}>KÜTÜPHANELERİM</Text>
          <Text style={S.title}>Listelerim</Text>
        </View>
        <TouchableOpacity style={S.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={22} color={colors.bg} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} size="large" />
      ) : (
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

          {/* Default collections — colored tiles */}
          <Text style={S.sectionLabel}>VARSAYILAN</Text>
          <View style={S.tileGrid}>
            {DEFAULT_COLLECTIONS.map(col => (
              <TouchableOpacity
                key={col.id}
                style={[S.tile, { width: col.id === 'hard' ? SW - 40 : TILE }]}
                onPress={() => openCollection(col)}
                activeOpacity={0.82}
              >
                <View style={[S.tileIconWrap, { backgroundColor: col.bg }]}>
                  <Text style={S.tileEmoji}>{col.emoji}</Text>
                </View>
                <Text style={[S.tileName, { color: col.color }]}>{col.name}</Text>
                <Text style={S.tileCount}>{wordCounts[col.id] ?? 0} kelime</Text>
                <View style={[S.tileAccent, { backgroundColor: col.color }]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom collections */}
          {collections.length > 0 && (
            <>
              <Text style={S.sectionLabel}>KİŞİSEL</Text>
              <View style={{ gap: 8 }}>
                {collections.map(col => (
                  <TouchableOpacity
                    key={col.id}
                    style={S.listCard}
                    onPress={() => openCollection(col)}
                    activeOpacity={0.82}
                  >
                    <View style={S.listCardLeft}>
                      <View style={S.listCardIcon}>
                        <Text style={S.listCardEmoji}>{col.emoji || '📁'}</Text>
                      </View>
                      <View>
                        <Text style={S.listCardName}>{col.name}</Text>
                        <Text style={S.listCardCount}>{wordCounts[col.id] ?? 0} kelime</Text>
                      </View>
                    </View>
                    <View style={S.listCardRight}>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      <TouchableOpacity onPress={() => deleteCollection(col.id)} style={S.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="trash-outline" size={16} color="#f87171" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {collections.length === 0 && (
            <TouchableOpacity style={S.createCard} onPress={() => setModalVisible(true)}>
              <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
              <Text style={S.createCardText}>Yeni Liste Oluştur</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Create modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={S.modalBg} onPress={() => setModalVisible(false)}>
          <Pressable style={S.sheet} onPress={e => e.stopPropagation()}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>Yeni Liste</Text>

            {/* Emoji picker */}
            <Text style={S.sheetLabel}>İkon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {['📁', '⭐', '📚', '🎯', '💼', '🏆', '🔑', '💬', '🧠', '🌍', '✈️', '🎓'].map(e => (
                <TouchableOpacity
                  key={e}
                  style={[S.emojiChip, newEmoji === e && S.emojiChipActive]}
                  onPress={() => setNewEmoji(e)}
                >
                  <Text style={S.emojiChipText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={S.sheetLabel}>Ad</Text>
            <TextInput
              style={S.input}
              placeholder="Liste adı..."
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={createCollection}
              returnKeyType="done"
            />
            <View style={S.sheetBtns}>
              <TouchableOpacity style={S.cancelBtn} onPress={() => { setModalVisible(false); setNewName(''); setNewEmoji('📁') }}>
                <Text style={S.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.createBtn, !newName.trim() && { opacity: 0.5 }]} onPress={createCollection} disabled={!newName.trim()}>
                <Text style={S.createBtnText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  addBtn: { backgroundColor: colors.accent, borderRadius: 12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 6 },

  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  sectionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },

  /* Default tiles */
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: 24 },
  tile: { backgroundColor: colors.bgCard, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, overflow: 'hidden' },
  tileIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileEmoji: { fontSize: 22 },
  tileName: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  tileCount: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  tileAccent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },

  /* Custom list cards */
  listCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  listCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listCardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  listCardEmoji: { fontSize: 20 },
  listCardName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  listCardCount: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  listCardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: { padding: 4 },

  /* Create card */
  createCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: 16, marginTop: 8, justifyContent: 'center' },
  createCardText: { color: colors.accent, fontSize: 14, fontWeight: '700' },

  /* Empty */
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  /* Detail header */
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn: { padding: 4 },
  detailHeaderMid: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  detailEmoji: { fontSize: 28 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  detailCount: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  detailAccentBar: { height: 3, marginHorizontal: 20, borderRadius: 2, marginBottom: 8 },

  /* Word cards */
  wordCard: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  wordAccentBar: { width: 4 },
  wordBody: { flex: 1, padding: 14 },
  wordTop: { flexDirection: 'row', alignItems: 'flex-start' },
  wordTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 },
  wordText: { fontSize: 17, fontWeight: '700', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  ipa: { color: colors.textMuted, fontSize: 11, fontFamily: 'Courier', marginBottom: 3 },
  wordTr: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  speakBtn: { padding: 4, marginLeft: 8 },
  context: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 },

  /* Modal */
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 20 },
  sheetLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  emojiChip: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  emojiChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(250,204,21,0.1)' },
  emojiChipText: { fontSize: 22 },
  input: { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 14, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 20 },
  sheetBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: colors.textMuted, fontWeight: '700', fontSize: 15 },
  createBtn: { flex: 2, backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  createBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
})
