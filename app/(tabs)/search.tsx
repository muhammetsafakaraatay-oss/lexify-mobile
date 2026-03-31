import { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import * as Speech from 'expo-speech'

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const cefrColor: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('saved_words')
      .select('*')
      .eq('user_id', user.id)
      .or(`word.ilike.%${query}%,translation.ilike.%${query}%`)
      .order('created_at', { ascending: false })
    setResults(data || [])
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Ara</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Kelime veya ceviri ara..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="search" size={20} color={colors.bg} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      ) : searched && results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sonuc bulunamadi</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardMain}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={styles.word}>{item.word}</Text>
                    {item.cefr && (
                      <View style={[styles.cefrBadge, { borderColor: cefrColor[item.cefr] || colors.border }]}>
                        <Text style={[styles.cefrText, { color: cefrColor[item.cefr] || colors.textMuted }]}>{item.cefr}</Text>
                      </View>
                    )}
                    {item.mastered && <Text style={{ color: '#4ade80', fontSize: 14 }}>✓</Text>}
                  </View>
                  <Text style={styles.translation}>{item.translation}</Text>
                  {item.context ? <Text style={styles.context} numberOfLines={1}>{item.context}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => Speech.speak(item.word, { language: 'en-US', rate: 0.8 })}>
                  <Text style={{ fontSize: 20 }}>🔊</Text>
                </TouchableOpacity>
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
  title: { fontSize: 28, fontWeight: '800', color: colors.text, paddingHorizontal: 20, paddingTop: 8, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  input: { flex: 1, backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  searchBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  card: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontSize: 18, fontWeight: '700', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  translation: { color: colors.accent, fontSize: 14 },
  context: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
})
