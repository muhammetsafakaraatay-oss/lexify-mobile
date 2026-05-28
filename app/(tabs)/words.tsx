import { useEffect, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator
} from 'react-native'
import { deleteSavedWord, listUniqueSavedWords, SavedWord } from '../../lib/dataApi'
import { cefrColors, cefrLevels } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { speak } from '../../lib/speech'
import { Ionicons } from '@expo/vector-icons'

type SortMode = 'date' | 'alpha' | 'cefr'

const stageColor: Record<string, string> = {
  new: '#60a5fa', learning: '#facc15', review: '#4ade80',
  mastered: '#a3e635', leech: '#f87171',
}
const stageLabel: Record<string, string> = {
  new: 'Yeni', learning: 'Öğreniliyor', review: 'Tekrar',
  mastered: 'Öğrenildi', leech: 'Zor',
}

export default function WordsScreen() {
  const [words, setWords] = useState<SavedWord[]>([])
  const [filtered, setFiltered] = useState<SavedWord[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Tümü')
  const [sortMode, setSortMode] = useState<SortMode>('date')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { loadWords() }, [])
  useFocusEffect(require('react').useCallback(() => { loadWords() }, []))

  useEffect(() => {
    let result = [...words]
    if (search) result = result.filter(w =>
      w.word.toLowerCase().includes(search.toLowerCase()) ||
      w.translation?.toLowerCase().includes(search.toLowerCase())
    )
    if (filter !== 'Tümü') result = result.filter(w => w.cefr === filter)
    if (sortMode === 'alpha') result.sort((a, b) => a.word.localeCompare(b.word))
    else if (sortMode === 'cefr') {
      const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      result.sort((a, b) => order.indexOf(a.cefr || '') - order.indexOf(b.cefr || ''))
    }
    setFiltered(result)
  }, [words, search, filter, sortMode])

  async function loadWords() {
    setWords(await listUniqueSavedWords({ orderBy: 'created_at', ascending: false }))
    setLoading(false)
  }

  async function deleteWord(id: string) {
    await deleteSavedWord(id)
    setWords(p => p.filter(w => w.id !== id))
  }

  const mastered = words.filter(w => w.stage === 'mastered').length
  const learning = words.filter(w => w.stage === 'learning' || w.stage === 'review').length
  const newCount = words.length - mastered - learning

  const sortIcons: Record<SortMode, string> = { date: 'time-outline', alpha: 'text-outline', cefr: 'bar-chart-outline' }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>KÜTÜPHANELERİM</Text>
          <Text style={styles.title}>Kelimelerim</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setSortMode(s => s === 'date' ? 'alpha' : s === 'alpha' ? 'cefr' : 'date')}>
            <Ionicons name={sortIcons[sortMode] as any} size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.accentBtn} onPress={() => router.push('/(tabs)/flashcards')}>
            <Ionicons name="layers-outline" size={16} color={colors.bg} />
            <Text style={styles.accentBtnText}>Flashcard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      {words.length > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: colors.accent }]} />
            <Text style={styles.statNum}>{words.length}</Text>
            <Text style={styles.statLabel}>toplam</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: '#4ade80' }]} />
            <Text style={[styles.statNum, { color: '#4ade80' }]}>{mastered}</Text>
            <Text style={styles.statLabel}>öğrenildi</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: '#60a5fa' }]} />
            <Text style={[styles.statNum, { color: '#60a5fa' }]}>{learning}</Text>
            <Text style={styles.statLabel}>öğreniliyor</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: colors.textMuted }]} />
            <Text style={styles.statNum}>{newCount}</Text>
            <Text style={styles.statLabel}>yeni</Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          placeholder="Kelime ara..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter */}
      <FlatList
        data={cefrLevels}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
        keyExtractor={i => i}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterBtn, filter === item && styles.filterBtnActive, filter === item && item !== 'Tümü' && { backgroundColor: cefrColors[item], borderColor: cefrColors[item] }]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && { color: item === 'Tümü' ? colors.bg : '#000' }]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>{search || filter !== 'Tümü' ? 'Kelime bulunamadı' : 'Henüz kelime yok'}</Text>
          {!search && filter === 'Tümü' && (
            <Text style={styles.emptyHint}>Oku ekranından bir kelimeye dokun ve kaydet</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <View style={styles.wordCard}>
              {/* Left accent bar colored by stage */}
              <View style={[styles.stageBar, { backgroundColor: stageColor[item.stage] || colors.border }]} />
              <View style={styles.wordBody}>
                <View style={styles.wordTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.wordTitleRow}>
                      <Text style={styles.word}>{item.word}</Text>
                      {item.cefr && (
                        <View style={[styles.cefrBadge, { borderColor: cefrColors[item.cefr] || colors.border }]}>
                          <Text style={[styles.cefrText, { color: cefrColors[item.cefr] || colors.textMuted }]}>{item.cefr}</Text>
                        </View>
                      )}
                    </View>
                    {item.ipa ? <Text style={styles.ipa}>/{item.ipa}/</Text> : null}
                    <Text style={styles.translation}>{item.translation}</Text>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => speak(item.word, { rate: 0.8 })}>
                      <Ionicons name="volume-medium-outline" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => deleteWord(item.id)}>
                      <Ionicons name="trash-outline" size={18} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                </View>
                {item.context ? <Text style={styles.context} numberOfLines={2}>{item.context}</Text> : null}
                <View style={styles.wordFooter}>
                  <View style={[styles.stagePill, { backgroundColor: stageColor[item.stage] + '18' }]}>
                    <Text style={[styles.stageText, { color: stageColor[item.stage] }]}>{stageLabel[item.stage] || 'Yeni'}</Text>
                  </View>
                  {item.source_title ? (
                    <Text style={styles.source} numberOfLines={1}>{item.source_title}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  iconBtn: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8 },
  accentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  accentBtnText: { color: colors.bg, fontWeight: '700', fontSize: 13 },

  statsBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 0 },
  statItem: { flex: 1, alignItems: 'center', flexDirection: 'column', gap: 2 },
  statDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  statNum: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.bgSurface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  search: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 15 },
  clearBtn: { padding: 4 },

  filterList: { maxHeight: 40, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: colors.textDim, fontSize: 13, textAlign: 'center', maxWidth: 240 },

  wordCard: { backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', overflow: 'hidden' },
  stageBar: { width: 4 },
  wordBody: { flex: 1, padding: 14 },
  wordTop: { flexDirection: 'row', alignItems: 'flex-start' },
  wordTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 },
  word: { fontSize: 18, fontWeight: '700', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  ipa: { color: colors.textMuted, fontSize: 12, fontFamily: 'Courier', marginBottom: 3 },
  translation: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 2, marginLeft: 8 },
  actionBtn: { padding: 6 },
  context: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  wordFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  stagePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  stageText: { fontSize: 10, fontWeight: '700' },
  source: { color: colors.textDim, fontSize: 11, flex: 1 },
})
