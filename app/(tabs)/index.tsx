import { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, SafeAreaView, Modal,
  Pressable, Linking
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { translateWord, fetchArticle } from '../../lib/api'
import { colors } from '../../lib/theme'
import * as Speech from 'expo-speech'

function tokenize(text: string) {
  const out: { word: boolean; val: string }[] = []
  const re = /([a-zA-Z]+)|([^a-zA-Z]+)/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[1]) out.push({ word: true, val: m[1] })
    else out.push({ word: false, val: m[2] })
  }
  return out
}

const cefrColors: Record<string, string> = {
  C2: 'rgba(250,204,21,0.3)', C1: 'rgba(250,204,21,0.15)',
  B2: 'rgba(96,165,250,0.15)', B1: 'rgba(96,165,250,0.08)',
}

export default function OkuScreen() {
  const [input, setInput] = useState('')
  const [tokens, setTokens] = useState<{ word: boolean; val: string }[]>([])
  const [ready, setReady] = useState(false)
  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState<any>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const cache = useRef<Record<string, any>>({})

  async function saveHistory(articleUrl: string, text: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('reading_history').insert({
        user_id: user.id,
        url: articleUrl,
        title: articleUrl,
        word_count: text.split(' ').length,
      })
    } catch (e) { console.error(e) }
  }

  async function handleFetchArticle() {
    if (!url.trim()) return
    setFetching(true)
    try {
      const data = await fetchArticle(url)
      if (data.text) {
        setInput(data.text)
        await saveHistory(url, data.text)
        setUrl('')
      }
    } catch (e) { console.error(e) }
    finally { setFetching(false) }
  }

  function handleProcess() {
    if (!input.trim()) return
    setTokens(tokenize(input))
    setReady(true)
  }

  const getSentence = (index: number, toks: typeof tokens) => {
    return toks.slice(Math.max(0, index - 5), index + 6).map(t => t.val).join('')
  }

  const cefrHighlight: Record<string, string> = {
    C2: 'rgba(250,204,21,0.5)',
    C1: 'rgba(250,204,21,0.3)',
    B2: 'rgba(96,165,250,0.3)',
    B1: 'rgba(96,165,250,0.15)',
  }

  async function handleWordPress(word: string, sentence: string) {
    const k = word.toLowerCase()
    if (cache.current[k]) { setTip({ word, ...cache.current[k] }); return }
    setTip({ word, loading: true })
    const data = await translateWord(word, sentence)
    cache.current[k] = data
    setTip({ word, ...data })
  }

  async function handleSave() {
    if (!tip) return
    const k = tip.word.toLowerCase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (saved[k]) {
      await supabase.from('saved_words').delete().eq('user_id', user.id).eq('word', tip.word)
      setSaved(p => { const n = { ...p }; delete n[k]; return n })
    } else {
      await supabase.from('saved_words').upsert({
        user_id: user.id, word: tip.word,
        translation: tip.tr, context: tip.example || tip.context,
        cefr: tip.cefr
      }, { onConflict: 'user_id,word' })
      setSaved(p => ({ ...p, [k]: true }))
    }
  }

  const cefrColor: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  return (
    <SafeAreaView style={styles.container}>
      {!ready ? (
        <ScrollView contentContainerStyle={styles.inputArea}>
          <Text style={styles.title}>LexiTR<Text style={{ color: colors.accent }}>.</Text></Text>
          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              placeholder="Makale URL'si..."
              placeholderTextColor={colors.textMuted}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.urlBtn} onPress={handleFetchArticle} disabled={fetching}>
              {fetching ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.urlBtnText}>Getir</Text>}
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Ingilizce metni buraya yapistirin..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.processBtn} onPress={handleProcess}>
            <Text style={styles.processBtnText}>Metni Isle →</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.readArea}>
          <TouchableOpacity onPress={() => setReady(false)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.readText}>
            {tokens.map((t, i) =>
              t.word ? (
                <Text
                  key={i}
                  onPress={() => handleWordPress(t.val, getSentence(i, tokens))}
                  style={[
                    styles.word,
                    cache.current[t.val.toLowerCase()]?.cefr && {
                      backgroundColor: cefrHighlight[cache.current[t.val.toLowerCase()].cefr] || 'transparent',
                      borderRadius: 3,
                    },
                    tip?.word?.toLowerCase() === t.val.toLowerCase() && styles.wordActive
                  ]}
                >
                  {t.val}
                </Text>
              ) : (
                <Text key={i} style={styles.punct}>{t.val}</Text>
              )
            )}
          </Text>
        </ScrollView>
      )}

      <Modal visible={!!tip} transparent animationType="slide" onRequestClose={() => setTip(null)}>
        <Pressable style={styles.modalBg} onPress={() => setTip(null)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {tip?.loading ? (
              <ActivityIndicator color={colors.accent} style={{ margin: 32 }} />
            ) : tip ? (
              <>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.sheetWord}>{tip.word}</Text>
                      {tip.cefr && (
                        <View style={[styles.cefrBadge, { borderColor: cefrColor[tip.cefr] }]}>
                          <Text style={[styles.cefrText, { color: cefrColor[tip.cefr] }]}>{tip.cefr}</Text>
                        </View>
                      )}
                    </View>
                    {tip.ipa ? <Text style={styles.ipa}>{tip.ipa}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => Speech.speak(tip.word, { language: 'en-US', rate: 0.8 })}>
                    <Text style={styles.speakBtn}>🔊</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.translation}>{tip.tr}</Text>
                {tip.context ? <Text style={styles.context}>{tip.context}</Text> : null}
                {tip.examples?.length > 0 && (
                  <View style={styles.examples}>
                    {tip.examples.slice(0, 2).map((ex: string, i: number) => (
                      <Text key={i} style={styles.example}>• {ex}</Text>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.saveBtn, saved[tip.word?.toLowerCase()] && styles.saveBtnSaved]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveBtnText}>
                    {saved[tip.word?.toLowerCase()] ? '✓ Kaydedildi' : '+ Kaydet'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inputArea: { padding: 24, paddingTop: 48 },
  title: { fontSize: 36, fontWeight: '800', color: colors.text, marginBottom: 24 },
  urlRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  urlInput: { flex: 1, backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  urlBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  urlBtnText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
  textInput: { backgroundColor: colors.bgSurface, borderRadius: 12, padding: 16, color: colors.text, fontSize: 15, minHeight: 200, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  processBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center' },
  processBtnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
  readArea: { padding: 20, paddingTop: 48 },
  backBtn: { marginBottom: 16 },
  backBtnText: { color: colors.accent, fontSize: 16 },
  readText: { fontSize: 17, lineHeight: 30, color: colors.text },
  word: { color: colors.text },
  wordActive: { backgroundColor: 'rgba(250,204,21,0.2)', borderRadius: 3 },
  punct: { color: colors.text },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, minHeight: 200 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  sheetWord: { fontSize: 28, fontWeight: '800', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cefrText: { fontSize: 11, fontWeight: '700' },
  ipa: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  speakBtn: { fontSize: 28, marginLeft: 8 },
  translation: { fontSize: 22, color: colors.accent, fontWeight: '600', marginBottom: 8 },
  context: { color: colors.textDim, fontSize: 14, marginBottom: 12, lineHeight: 20 },
  examples: { marginBottom: 16 },
  example: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnSaved: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: colors.border },
  saveBtnText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
})
