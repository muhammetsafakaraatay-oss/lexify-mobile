import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, SafeAreaView
} from 'react-native'
import { WordTipSheet } from '../../components/WordTipSheet'
import { useWordTip } from '../../hooks/useWordTip'
import { supabase } from '../../lib/supabase'
import { fetchArticle, fetchYoutubeTranscript } from '../../lib/api'
import { colors } from '../../lib/theme'
import { TextToken, tokenizeText } from '../../lib/tokenize'
import { useLocalSearchParams } from 'expo-router'

type InputMode = 'url' | 'text'
type ReaderMeta = {
  title: string
  sourceType: 'article_url' | 'manual_text' | 'youtube'
  sourceUrl?: string
}

const sampleText = `Learning a language takes time, but daily exposure makes a remarkable difference. When you read a short article, notice unfamiliar words, and review them later, your brain starts connecting meaning with real context.`

export default function OkuScreen() {
  const [input, setInput] = useState('')
  const [tokens, setTokens] = useState<TextToken[]>([])
  const [ready, setReady] = useState(false)
  const [url, setUrl] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [mode, setMode] = useState<InputMode>('url')
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const [readerMeta, setReaderMeta] = useState<ReaderMeta | null>(null)
  const params = useLocalSearchParams()
  const { tip, setTip, isSaved, getCacheEntry, openWordTip, saveTip, closeTip } = useWordTip()

  useEffect(() => {
    if (params.prefillUrl) {
      setMode('url')
      setUrl(params.prefillUrl as string)
      handleFetchArticleFromUrl(params.prefillUrl as string)
    }
  }, [params.prefillUrl])

  function getSourceType(articleUrl: string): ReaderMeta['sourceType'] {
    return articleUrl.includes('youtube.com') || articleUrl.includes('youtu.be') ? 'youtube' : 'article_url'
  }

  function makeTitleFromUrl(articleUrl: string) {
    try {
      const parsed = new URL(articleUrl)
      return parsed.hostname.replace('www.', '')
    } catch {
      return articleUrl
    }
  }

  function openReader(text: string, meta: ReaderMeta) {
    setInput(text)
    setTokens(tokenizeText(text))
    setReaderMeta(meta)
    setReady(true)
    setError('')
  }

  async function handleFetchArticleFromUrl(articleUrl: string) {
    setFetching(true)
    setError('')
    try {
      const isYoutube = getSourceType(articleUrl) === 'youtube'
      const data = isYoutube
        ? await fetchYoutubeTranscript(articleUrl)
        : await fetchArticle(articleUrl)
      if (data.text) {
        openReader(data.text, {
          title: makeTitleFromUrl(articleUrl),
          sourceType: getSourceType(articleUrl),
          sourceUrl: articleUrl,
        })
        await saveHistory(articleUrl, data.text)
        return
      }
      setError('İçerik alınamadı. Farklı bir link deneyin veya metni yapıştırın.')
    } catch (e) {
      setError('Link işlenemedi. Sayfa korumalı olabilir; bu durumda metni manuel yapıştırabilirsiniz.')
    }
    finally { setFetching(false) }
  }

  const cefrHighlight: Record<string, string> = {
    C2: 'rgba(250,204,21,0.5)', C1: 'rgba(250,204,21,0.3)',
    B2: 'rgba(96,165,250,0.3)', B1: 'rgba(96,165,250,0.15)',
  }

  async function saveHistory(articleUrl: string, text: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Başlık çıkar
      let title = articleUrl
      const titleMatch = text.match(/^([^.!?]{10,100})[.!?]/)
      if (titleMatch) title = titleMatch[1].trim()
      await supabase.from('reading_history').insert({
        user_id: user.id, url: articleUrl,
        title: title, word_count: text.split(' ').length,
      })
    } catch (e) {}
  }

  async function handleFetchArticle() {
    if (!url.trim()) return
    await handleFetchArticleFromUrl(url)
  }

  function handleProcess() {
    if (!input.trim()) return
    openReader(input, {
      title: manualTitle.trim() || 'Yapıştırılan Metin',
      sourceType: 'manual_text',
    })
  }

  function loadSample() {
    setMode('text')
    setManualTitle('Günlük İngilizce Pratiği')
    setInput(sampleText)
    setError('')
  }

  const getSentence = (index: number, toks: TextToken[]) =>
    toks.slice(Math.max(0, index - 5), index + 6).map(t => t.val).join('')

  const wordCount = tokens.filter((token) => token.word).length

  return (
    <SafeAreaView style={styles.container}>
      {!ready ? (
        <ScrollView contentContainerStyle={styles.inputArea}>
          <Text style={styles.title}>Oku<Text style={{ color: colors.accent }}>.</Text></Text>
          <Text style={styles.subtitle}>
            Haber linki yapıştır, YouTube transcript aç ya da doğrudan İngilizce metin ekle. Sonra kelimelere dokunup öğren.
          </Text>

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeChip, mode === 'url' && styles.modeChipActive]}
              onPress={() => { setMode('url'); setError('') }}
            >
              <Text style={[styles.modeChipText, mode === 'url' && styles.modeChipTextActive]}>Link ile Getir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, mode === 'text' && styles.modeChipActive]}
              onPress={() => { setMode('text'); setError('') }}
            >
              <Text style={[styles.modeChipText, mode === 'text' && styles.modeChipTextActive]}>Metin Yapıştır</Text>
            </TouchableOpacity>
          </View>

          {mode === 'url' ? (
            <>
              <View style={styles.urlRow}>
                <TextInput
                  style={styles.urlInput}
                  placeholder="BBC, NYT veya YouTube linki..."
                  placeholderTextColor={colors.textMuted}
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.urlBtn} onPress={handleFetchArticle} disabled={fetching}>
                  {fetching ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.urlBtnText}>Getir</Text>}
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>Bazı siteler korumalı olabilir. Olmazsa aşağıdan metni manuel yapıştır.</Text>
            </>
          ) : (
            <>
              <TextInput
                style={styles.titleInput}
                placeholder="Başlık (opsiyonel)"
                placeholderTextColor={colors.textMuted}
                value={manualTitle}
                onChangeText={setManualTitle}
              />
              <TextInput
                style={styles.textInput}
                placeholder="İngilizce metni buraya yapıştırın..."
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity style={styles.processBtn} onPress={handleProcess}>
                <Text style={styles.processBtnText}>Okumaya Başla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sampleBtn} onPress={loadSample}>
                <Text style={styles.sampleBtnText}>Örnek metin yükle</Text>
              </TouchableOpacity>
            </>
          )}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>İçerik alınamadı</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Bu akış ne sağlar?</Text>
            <Text style={styles.infoText}>1. İçeriği aç</Text>
            <Text style={styles.infoText}>2. Bilmediğin kelimeye dokun</Text>
            <Text style={styles.infoText}>3. Anlam, CEFR ve okunuşu gör</Text>
            <Text style={styles.infoText}>4. Kelimeyi kaydet ve sonra kartlarla tekrar et</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.readArea}>
          <TouchableOpacity onPress={() => setReady(false)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Geri</Text>
          </TouchableOpacity>
          <View style={styles.readerMetaCard}>
            <Text style={styles.readerTitle}>{readerMeta?.title || 'Okuma Ekranı'}</Text>
            <View style={styles.readerMetaRow}>
              <View style={styles.readerMetaChip}>
                <Text style={styles.readerMetaChipText}>
                  {readerMeta?.sourceType === 'youtube' ? 'YouTube Transcript' : readerMeta?.sourceType === 'manual_text' ? 'Yapıştırılan Metin' : 'Makale'}
                </Text>
              </View>
              <Text style={styles.readerMetaText}>{wordCount} kelime</Text>
            </View>
            <Text style={styles.readerHint}>Bir kelimeye dokun. Sheet içinde anlam, CEFR, okunuş ve kaydetme aksiyonu var.</Text>
          </View>
          <Text style={styles.readText}>
            {tokens.map((t, i) =>
              t.word ? (
                <Text
                  key={i}
                  onPress={() => openWordTip(t.val, getSentence(i, tokens))}
                  style={[
                    styles.word,
                    getCacheEntry(t.val)?.cefr && {
                      backgroundColor: cefrHighlight[getCacheEntry(t.val)?.cefr || ''] || 'transparent',
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

      <WordTipSheet
        tip={tip}
        saved={isSaved}
        onClose={closeTip}
        onSave={async () => {
          await saveTip({
            toggleDelete: true,
            context: tip?.example || tip?.context,
            ipa: tip?.ipa,
            sourceTitle: readerMeta?.title,
            sourceUrl: readerMeta?.sourceUrl,
            sourceType: readerMeta?.sourceType,
          })
          if (!isSaved) {
            setTip((prev) => prev ? { ...prev } : prev)
          }
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inputArea: { padding: 24, paddingTop: 48 },
  title: { fontSize: 36, fontWeight: '800', color: colors.text, marginBottom: 24 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 18 },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  modeChip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.bgCard },
  modeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeChipText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  modeChipTextActive: { color: colors.bg },
  urlRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  urlInput: { flex: 1, backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  urlBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  urlBtnText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
  helperText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  titleInput: { backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  textInput: { backgroundColor: colors.bgSurface, borderRadius: 12, padding: 16, color: colors.text, fontSize: 15, minHeight: 200, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  processBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center' },
  processBtnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
  sampleBtn: { borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: 10 },
  sampleBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  errorCard: { backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 14, padding: 14, marginTop: 16 },
  errorTitle: { color: '#f87171', fontWeight: '800', fontSize: 14, marginBottom: 4 },
  errorText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  infoCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginTop: 18 },
  infoTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginBottom: 10 },
  infoText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  readArea: { padding: 20, paddingTop: 48 },
  backBtn: { marginBottom: 16 },
  backBtnText: { color: colors.accent, fontSize: 16 },
  readerMetaCard: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  readerTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  readerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  readerMetaChip: { backgroundColor: colors.accentDim, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  readerMetaChipText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  readerMetaText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  readerHint: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  readText: { fontSize: 17, lineHeight: 30, color: colors.text },
  word: { color: colors.text },
  wordActive: { backgroundColor: 'rgba(250,204,21,0.2)', borderRadius: 3 },
  punct: { color: colors.text },
})
