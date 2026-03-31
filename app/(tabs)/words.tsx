import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import * as Speech from 'expo-speech'

export default function WordsScreen() {
  const [words, setWords] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const cefrLevels = ['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const cefrColor: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  useEffect(() => { loadWords() }, [])

  useEffect(() => {
    let result = [...words]
    if (search) result = result.filter(w =>
      w.word.toLowerCase().includes(search.toLowerCase()) ||
      w.translation?.toLowerCase().includes(search.toLowerCase())
    )
    if (filter !== 'all') result = result.filter(w => w.cefr === filter)
    setFiltered(result)
  }, [words, search, filter])

  async function loadWords() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('saved_words').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })
    const unique = (data || []).filter((w, i, arr) =>
      arr.findIndex(x => x.word.toLowerCase() === w.word.toLowerCase()) === i
    )
    setWords(unique)
    setLoading(false)
  }

  async function deleteWord(id: string) {
    await supabase.from('saved_words').delete().eq('id', id)
    setWords(p => p.filter(w => w.id !== id))
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Kelimelerim</Text>

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
            style={[styles.filterBtn, filter === item && styles.filterBtnActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && { color: colors.bg }]}>{item.toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Kelime bulunamadi</Text>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={styles.word}>{item.word}</Text>
                    {item.cefr && (
                      <View style={[styles.cefrBadge, { borderColor: cefrColor[item.cefr] || colors.border }]}>
                        <Text style={[styles.cefrText, { color: cefrColor[item.cefr] || colors.textMuted }]}>{item.cefr}</Text>
                      </View>
                    )}
                    {item.mastered && <Text style={styles.masteredBadge}>✓</Text>}
                  </View>
                  <Text style={styles.translation}>{item.translation}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => Speech.speak(item.word, { language: 'en-US', rate: 0.8 })}>
                    <Text style={styles.actionBtn}>🔊</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteWord(item.id)}>
                    <Text style={styles.actionBtn}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {item.context ? <Text style={styles.context} numberOfLines={2}>{item.context}</Text> : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, padding: 20, paddingBottom: 12 },
  search: { marginHorizontal: 16, backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  filterList: { maxHeight: 44, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  wordCard: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  wordMain: { flexDirection: 'row', alignItems: 'flex-start' },
  word: { fontSize: 18, fontWeight: '700', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  masteredBadge: { color: '#4ade80', fontSize: 14 },
  translation: { color: colors.accent, fontSize: 14, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { fontSize: 20 },
  context: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
})
