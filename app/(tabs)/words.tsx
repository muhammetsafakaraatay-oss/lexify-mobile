import { useEffect, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator, Share, Alert,
} from 'react-native'
import { deleteSavedWord, listUniqueSavedWords, SavedWord } from '../../lib/data'
import { cefrColors, cefrLevels } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { speak } from '../../lib/speech'
import { Ionicons } from '@expo/vector-icons'

type SortMode = 'date' | 'alpha' | 'cefr'

export default function WordsScreen() {
  const [words, setWords] = useState<SavedWord[]>([])
  const [filtered, setFiltered] = useState<SavedWord[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Tümü')
  const [sortMode, setSortMode] = useState<SortMode>('date')
  const [loading, setLoading] = useState(true)

  const router = useRouter()

  useEffect(() => { loadWords() }, [])

  useFocusEffect(
    require('react').useCallback(() => { loadWords() }, [])
  )

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
      result.sort((a, b) => (order.indexOf(a.cefr || '') - order.indexOf(b.cefr || '')))
    }

    setFiltered(result)
  }, [words, search, filter, sortMode])

  async function loadWords() {
    setLoading(true)
    try {
      const nextWords = await listUniqueSavedWords({ orderBy: 'created_at', ascending: false })
      setWords(nextWords)
    } catch (error) {
      console.warn('[words] loadWords failed:', error)
      setWords([])
    } finally {
      setLoading(false)
    }
  }

  async function deleteWord(id: string) {
    await deleteSavedWord(id)
    setWords(p => p.filter(w => w.id !== id))
  }

  async function shareWordList() {
    if (filtered.length === 0) {
      Alert.alert('Liste boş', 'Paylaşılacak kelime yok.')
      return
    }
    const lines = filtered.map((w) => {
      const tr = w.translation ? ` — ${w.translation}` : ''
      const level = w.cefr ? ` [${w.cefr}]` : ''
      return `• ${w.word}${tr}${level}`
    })
    try {
      await Share.share({
        message: `Lexify — Kelimelerim (${filtered.length})\n\n${lines.join('\n')}`,
        title: 'Lexify Kelime Listesi',
      })
    } catch {
      /* kullanıcı iptal */
    }
  }

  const mastered = words.filter(w => w.stage === 'mastered').length
  const learning = words.filter(w => w.stage === 'learning' || w.stage === 'review').length

  const sortIcons: Record<SortMode, string> = { date: 'time-outline', alpha: 'text-outline', cefr: 'bar-chart-outline' }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Kelimelerim</Text>
          <View style={styles.iconActions}>
            <TouchableOpacity style={styles.sortBtn} onPress={shareWordList}>
              <Ionicons name="share-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortBtn} onPress={() => {
              setSortMode(s => s === 'date' ? 'alpha' : s === 'alpha' ? 'cefr' : 'date')
            }}>
              <Ionicons name={sortIcons[sortMode] as any} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.gameActions}>
          <TouchableOpacity style={styles.quizBtn} onPress={() => router.push('/(tabs)/flashcards')}>
            <Text style={styles.quizBtnText}>🃏 Kart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quizBtn} onPress={() => router.push('/(tabs)/quiz')}>
            <Text style={styles.quizBtnText}>🎮 Quiz</Text>
          </TouchableOpacity>
        </View>
      </View>

      {words.length > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{words.length}</Text>
            <Text style={styles.statLabel}>toplam</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#4ade80' }]}>{mastered}</Text>
            <Text style={styles.statLabel}>öğrenildi</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#60a5fa' }]}>{learning}</Text>
            <Text style={styles.statLabel}>öğreniliyor</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#fb923c' }]}>{words.length - mastered - learning}</Text>
            <Text style={styles.statLabel}>yeni</Text>
          </View>
        </View>
      )}

      <TextInput
        style={styles.search}
        placeholder="Kelime ara..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={cefrLevels}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        keyExtractor={i => i}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterBtn, filter === item && styles.filterBtnActive, filter === item && item !== 'Tümü' && { backgroundColor: cefrColors[item], borderColor: cefrColors[item] }]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && { color: item === 'Tümü' ? colors.bg : '#000' }]}>{item.toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={36} color={colors.textMuted} />
          <Text style={styles.emptyText}>{search || filter !== 'Tümü' ? 'Kelime bulunamadı' : 'Henüz kelime yok'}</Text>
          {!search && filter === 'Tümü' ? (
            <>
              <Text style={styles.emptyHint}>Keşfet’ten makale aç veya Oku’da metin yapıştır, kelimeye dokunup kaydet.</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(tabs)/catalog')}>
                  <Text style={styles.emptyCtaText}>Makale Keşfet</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.emptyCta, styles.emptyCtaOutline]} onPress={() => router.push('/(tabs)/oku')}>
                  <Text style={[styles.emptyCtaText, styles.emptyCtaTextOutline]}>Metin Oku</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.wordCard}>
              <View style={styles.wordMain}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <Text style={styles.word}>{item.word}</Text>
                    {item.cefr && (
                      <View style={[styles.cefrBadge, { borderColor: cefrColors[item.cefr] || colors.border }]}>
                        <Text style={[styles.cefrText, { color: cefrColors[item.cefr] || colors.textMuted }]}>{item.cefr}</Text>
                      </View>
                    )}
                    {item.stage === 'mastered' && (
                      <View style={styles.masteredBadge}>
                        <Text style={styles.masteredText}>✓ öğrenildi</Text>
                      </View>
                    )}
                  </View>
                  {item.ipa ? <Text style={styles.ipa}>/{item.ipa}/</Text> : null}
                  <Text style={styles.translation}>{item.translation}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => speak(item.word, { rate: 0.8 })}
                  >
                    <Ionicons name="volume-medium-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => deleteWord(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#f87171" />
                  </TouchableOpacity>
                </View>
              </View>
              {item.context ? <Text style={styles.context} numberOfLines={2}>{item.context}</Text> : null}
              {item.source_title ? (
                <View style={styles.sourceRow}>
                  <Ionicons name="link-outline" size={11} color={colors.textDim} />
                  <Text style={styles.source} numberOfLines={1}>{item.source_title}</Text>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  iconActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  gameActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sortBtn: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8 },
  quizBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, flex: 1, alignItems: 'center' },
  quizBtnText: { color: colors.bg, fontWeight: '700', fontSize: 13 },
  statsBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: colors.bgCard, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  search: { marginHorizontal: 16, backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  filterList: { maxHeight: 44, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: colors.textDim, fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  emptyCta: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  emptyCtaOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  emptyCtaText: { color: colors.bg, fontWeight: '800', fontSize: 13 },
  emptyCtaTextOutline: { color: colors.text },
  wordCard: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  wordMain: { flexDirection: 'row', alignItems: 'flex-start' },
  word: { fontSize: 18, fontWeight: '700', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  masteredBadge: { backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  masteredText: { color: '#4ade80', fontSize: 10, fontWeight: '700' },
  ipa: { color: colors.textMuted, fontSize: 12, fontFamily: 'Courier', marginTop: 1 },
  translation: { color: colors.accent, fontSize: 14, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  actionBtn: { padding: 6 },
  context: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  source: { color: colors.textDim, fontSize: 11, flex: 1 },
})
