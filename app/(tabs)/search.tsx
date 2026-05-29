import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native'
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

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      setSearched(true)
      setResults(await listSavedWords({ search: q, orderBy: 'created_at', ascending: false }))
      setLoading(false)
    }, 320)

    return () => clearTimeout(timer)
  }, [query])

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Ara</Text>
      <Text style={styles.subtitle}>Kayıtlı kelimelerinde İngilizce veya Türkçe ara</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Kelime veya çeviri ara..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {query.length > 0 ? (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      ) : searched && results.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
          <Text style={styles.emptyHint}>Farklı bir yazım veya kısaltma dene</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardMain}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <Text style={styles.word}>{item.word}</Text>
                    {item.cefr ? (
                      <View style={[styles.cefrBadge, { borderColor: cefrColors[item.cefr] || colors.border }]}>
                        <Text style={[styles.cefrText, { color: cefrColors[item.cefr] || colors.textMuted }]}>{item.cefr}</Text>
                      </View>
                    ) : null}
                    {item.stage === 'mastered' ? <Text style={{ color: '#4ade80', fontSize: 14 }}>✓</Text> : null}
                  </View>
                  <Text style={styles.translation}>{item.translation}</Text>
                  {item.context ? <Text style={styles.context} numberOfLines={1}>{item.context}</Text> : null}
                </View>
                <TouchableOpacity style={styles.speakBtn} onPress={() => speak(item.word, { rate: 0.8 })}>
                  <Ionicons name="volume-medium-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="text-outline" size={36} color={colors.textDim} />
          <Text style={styles.emptyHint}>Aramaya başlamak için yaz</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, paddingHorizontal: 20, paddingTop: 8, marginBottom: 4 },
  subtitle: { color: colors.textMuted, fontSize: 13, paddingHorizontal: 20, marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearBtn: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  speakBtn: { padding: 6 },
  card: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontSize: 18, fontWeight: '700', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  translation: { color: colors.accent, fontSize: 14 },
  context: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
})
