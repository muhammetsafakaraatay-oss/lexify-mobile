import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Modal, TextInput, Pressable, Alert
} from 'react-native'
import {
  createCollection as createCollectionRecord,
  deleteCollectionById,
  listCollections,
  listSavedWords,
  listWordsForCollection,
  SavedWord,
} from '../../lib/data'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

const DEFAULT_COLLECTIONS = [
  { id: 'favorites', name: 'Favoriler', emoji: '⭐' },
  { id: 'later', name: 'Daha Sonra', emoji: '🔖' },
  { id: 'hard', name: 'Zor Kelimeler', emoji: '🔥' },
]

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [newName, setNewName] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [words, setWords] = useState<SavedWord[]>([])
  const [wordsLoading, setWordsLoading] = useState(false)

  useEffect(() => { loadCollections() }, [])

  async function loadCollections() {
    setCollections(await listCollections())
    setLoading(false)
  }

  async function createCollection() {
    if (!newName.trim()) return
    const data = await createCollectionRecord(newName.trim())
    if (data) setCollections(p => [...p, data])
    setNewName('')
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

  const allCollections = [...DEFAULT_COLLECTIONS, ...collections]

  if (selected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selected.emoji || '📁'} {selected.name}</Text>
          <View style={{ width: 40 }} />
        </View>
        {wordsLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
        ) : words.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Bu listede kelime yok</Text>
          </View>
        ) : (
          <FlatList
            data={words}
            keyExtractor={(i, idx) => `col-${i.id}-${idx}`}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => (
              <View style={styles.wordCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.word}>{item.word}</Text>
                  {item.cefr && (
                    <View style={[styles.cefrBadge, { borderColor: cefrColors[item.cefr] || colors.border }]}>
                      <Text style={[styles.cefrText, { color: cefrColors[item.cefr] || colors.textMuted }]}>{item.cefr}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.translation}>{item.translation}</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Listelerim</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color={colors.bg} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={allCollections}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.collectionCard} onPress={() => openCollection(item)}>
              <Text style={styles.collectionEmoji}>{item.emoji || '📁'}</Text>
              <Text style={styles.collectionName}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
              {!['favorites', 'later', 'hard'].includes(item.id) && (
                <TouchableOpacity onPress={() => deleteCollection(item.id)} style={{ marginLeft: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#f87171" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalBg} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Yeni Liste</Text>
            <TextInput
              style={styles.input}
              placeholder="Liste adı..."
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TouchableOpacity style={styles.createBtn} onPress={createCollection}>
              <Text style={styles.createBtnText}>Oluştur</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  addBtn: { backgroundColor: colors.accent, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  collectionCard: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border },
  collectionEmoji: { fontSize: 24 },
  collectionName: { fontSize: 16, fontWeight: '600', color: colors.text },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  wordCard: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 4 },
  word: { fontSize: 18, fontWeight: '700', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  translation: { color: colors.accent, fontSize: 14 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  input: { backgroundColor: colors.bgSurface, borderRadius: 10, padding: 14, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  createBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  createBtnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
})
