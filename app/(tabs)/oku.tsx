import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, SafeAreaView, NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { WordTipSheet } from '../../components/WordTipSheet'
import { useWordTip } from '../../hooks/useWordTip'
import { addReadingHistory } from '../../lib/dataApi'
import { fetchArticle, fetchYoutubeTranscript } from '../../lib/api'
import { colors } from '../../lib/theme'
import { TextToken, tokenizeText } from '../../lib/tokenize'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

type InputMode = 'url' | 'text'
type ReaderMeta = {
  title: string
  sourceType: 'article_url' | 'manual_text' | 'youtube'
  sourceUrl?: string
}

const sampleText = `Learning a language takes time, but daily exposure makes a remarkable difference. When you read a short article, notice unfamiliar words, and review them later, your brain starts connecting meaning with real context. The process becomes natural over time, especially when you encounter words repeatedly across different sources.`

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
  const [scrollProgress, setScrollProgress] = useState(0)
  const params = useLocalSearchParams()
  const { tip, setTip, isSaved, getCacheEntry, openWordTip, saveTip, closeTip } = useWordTip()
  const scrollRef = useRef<ScrollView>(null)

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
    setScrollProgress(0)
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
    C2: 'rgba(232,121,249,0.4)', C1: 'rgba(248,113,113,0.3)',
    B2: 'rgba(251,146,60,0.3)', B1: 'rgba(250,204,21,0.2)',
  }

  async function saveHistory(articleUrl: string, text: string) {
    try {
      let title = articleUrl
      const titleMatch = text.match(/^([^.!?]{10,100})[.!?]/)
      if (titleMatch) title = titleMatch[1].trim()
      await addReadingHistory({ url: articleUrl, title, word_count: text.split(' ').length })
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
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200))

  const savedCount = Object.keys(
    tokens.filter(t => t.word && getCacheEntry(t.val)).reduce((acc, t) => {
      const k = t.val.toLowerCase()
      if (isSaved) acc[k] = true
      return acc
    }, {} as Record<string, boolean>)
  ).length

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const progress = contentOffset.y / Math.max(1, contentSize.height - layoutMeasurement.height)
    setScrollProgress(Math.min(1, Math.max(0, progress)))
  }

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
              <Ionicons name="link-outline" size={15} color={mode === 'url' ? colors.bg : colors.textMuted} />
              <Text style={[styles.modeChipText, mode === 'url' && styles.modeChipTextActive]}>Link ile Getir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, mode === 'text' && styles.modeChipActive]}
              onPress={() => { setMode('text'); setError('') }}
            >
              <Ionicons name="create-outline" size={15} color={mode === 'text' ? colors.bg : colors.textMuted} />
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
                  keyboardType="url"
                />
                <TouchableOpacity style={styles.urlBtn} onPress={handleFetchArticle} disabled={fetching}>
                  {fetching
                    ? <ActivityIndicator color={colors.bg} size="small" />
                    : <Ionicons name="arrow-forward" size={20} color={colors.bg} />
                  }
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
              <Ionicons name="alert-circle-outline" size={18} color="#f87171" />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorTitle}>İçerik alınamadı</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Nasıl çalışır?</Text>
            {[
              { icon: 'globe-outline', text: 'Makale veya YouTube linki aç' },
              { icon: 'hand-left-outline', text: 'Bilmediğin kelimeye dokun' },
              { icon: 'school-outline', text: 'Anlam, CEFR seviyesi ve IPA gör' },
              { icon: 'bookmark-outline', text: 'Kaydet ve flashcard ile tekrar et' },
            ].map(({ icon, text }) => (
              <View key={icon} style={styles.infoRow}>
                <Ionicons name={icon as any} size={15} color={colors.accent} />
                <Text style={styles.infoText}>{text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={styles.readerHeader}>
            <TouchableOpacity onPress={() => setReady(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.readerTitleSmall} numberOfLines={1}>{readerMeta?.title || 'Okuma'}</Text>
              <Text style={styles.readerMeta}>{wordCount} kelime · ~{readingMinutes} dk</Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(scrollProgress * 100)}%` }]} />
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.readArea}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            <View style={styles.metaChips}>
              <View style={styles.readerMetaChip}>
                <Text style={styles.readerMetaChipText}>
                  {readerMeta?.sourceType === 'youtube' ? 'YouTube' : readerMeta?.sourceType === 'manual_text' ? 'Metin' : 'Makale'}
                </Text>
              </View>
              <Text style={styles.readerHint}>Kelimeye dokun → anlam al</Text>
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

            <View style={styles.cefrLegend}>
              <Text style={styles.legendTitle}>Renk Göstergesi</Text>
              <View style={styles.legendRow}>
                {[
                  { level: 'B1', color: 'rgba(250,204,21,0.2)' },
                  { level: 'B2', color: 'rgba(251,146,60,0.3)' },
                  { level: 'C1', color: 'rgba(248,113,113,0.3)' },
                  { level: 'C2', color: 'rgba(232,121,249,0.4)' },
                ].map(({ level, color }) => (
                  <View key={level} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: color, borderRadius: 3 }]} />
                    <Text style={styles.legendText}>{level}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </>
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
  title: { fontSize: 36, fontWeight: '800', color: colors.text, marginBottom: 10 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 20 },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, backgroundColor: colors.bgCard },
  modeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeChipText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  modeChipTextActive: { color: colors.bg },
  urlRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  urlInput: { flex: 1, backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  urlBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', width: 48 },
  helperText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  titleInput: { backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  textInput: { backgroundColor: colors.bgSurface, borderRadius: 12, padding: 16, color: colors.text, fontSize: 15, minHeight: 200, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  processBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center' },
  processBtnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
  sampleBtn: { borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: 10 },
  sampleBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  errorCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 14, padding: 14, marginTop: 16 },
  errorTitle: { color: '#f87171', fontWeight: '800', fontSize: 14, marginBottom: 4 },
  errorText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  infoCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginTop: 20 },
  infoTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  infoText: { color: colors.textMuted, fontSize: 13 },
  readerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  readerTitleSmall: { color: colors.text, fontSize: 15, fontWeight: '700' },
  readerMeta: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  progressBar: { height: 3, backgroundColor: '#1a1a1a' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  readArea: { padding: 20, paddingBottom: 60 },
  metaChips: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  readerMetaChip: { backgroundColor: colors.accentDim, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  readerMetaChipText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  readerHint: { color: colors.textMuted, fontSize: 12 },
  readText: { fontSize: 18, lineHeight: 32, color: colors.text },
  word: { color: colors.text },
  wordActive: { backgroundColor: 'rgba(250,204,21,0.25)', borderRadius: 3 },
  punct: { color: colors.text },
  cefrLegend: { marginTop: 32, padding: 14, backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  legendTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14 },
  legendText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
})
