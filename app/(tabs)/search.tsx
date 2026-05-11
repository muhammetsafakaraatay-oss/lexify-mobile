import { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listSavedWords, SavedWord } from '../../lib/data'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { speak } from '../../lib/speech'

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SavedWord[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(q = query) {
    if (!q.trim()) return
    setLoading(true)
    setSearched(true)
    setResults(await listSavedWords({ search: q, orderBy: 'created_at', ascending: false }))
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>KÜTÜPHANELERİM</Text>
        <Text style={styles.title}>Kelime Ara</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Kelime veya çeviri ara..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={q => { setQuery(q); if (!q) { setSearched(false); setResults([]) } }}
          onSubmitEditing={() => handleSearch()}
          returnKeyType="search"
          autoFocus
        />
        {query ? (
          <TouchableOpacity onPress={() => { setQuery(''); setSearched(false); setResults([]) }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : searched && results.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sonuç bulunamadı</Text>
          <Text style={styles.emptyText}>"{query}" için kayıtlı kelime yok</Text>
        </View>
      ) : !searched ? (
        <View style={styles.hint}>
          <Ionicons name="bulb-outline" size={28} color={colors.textMuted} />
          <Text style={styles.hintText}>İngilizce kelime veya Türkçe çevirisiyle arayabilirsin</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.accentBar, { backgroundColor: cefrColors[item.cefr || ''] || colors.border }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.word}>{item.word}</Text>
                      {item.cefr && (
                        <View style={[styles.cefrBadge, { borderColor: cefrColors[item.cefr] || colors.border }]}>
                          <Text style={[styles.cefrText, { color: cefrColors[item.cefr] || colors.textMuted }]}>{item.cefr}</Text>
                        </View>
                      )}
                      {item.mastered && (
                        <View style={styles.masteredBadge}>
                          <Text style={styles.masteredText}>✓</Text>
                        </View>
                      )}
                    </View>
                    {item.ipa ? <Text style={styles.ipa}>/{item.ipa}/</Text> : null}
                    <Text style={styles.translation}>{item.translation}</Text>
                    {item.context ? <Text style={styles.context} numberOfLines={2}>{item.context}</Text> : null}
                  </View>
                  <TouchableOpacity style={styles.speakBtn} onPress={() => speak(item.word, { rate: 0.8 })}>
                    <Ionicons name="volume-medium-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
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
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.bgSurface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 4 },
  input: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 16 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  hintText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  card: { backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', overflow: 'hidden' },
  accentBar: { width: 4 },
  cardContent: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  word: { fontSize: 18, fontWeight: '700', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  masteredBadge: { backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  masteredText: { color: '#4ade80', fontSize: 12, fontWeight: '700' },
  ipa: { color: colors.textMuted, fontSize: 12, fontFamily: 'Courier', marginBottom: 3 },
  translation: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  context: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  speakBtn: { padding: 6, marginLeft: 4 },
})
