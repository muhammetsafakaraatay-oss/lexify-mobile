import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, SafeAreaView, NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { WordTipSheet } from '../../components/WordTipSheet'
import { SelectableReaderText } from '../../components/reader/SelectableReaderText'
import { SelectionToolbar } from '../../components/reader/SelectionToolbar'
import { BatchTranslationSheet } from '../../components/reader/BatchTranslationSheet'
import { SentenceTranslationSheet } from '../../components/reader/SentenceTranslationSheet'
import { useWordTip } from '../../hooks/useWordTip'
import { useReaderSelection } from '../../hooks/useReaderSelection'
import { useSentenceTranslate } from '../../hooks/useSentenceTranslate'
import { getSentenceSpan } from '../../lib/sentence'
import { listSavedWords, markSavedWordsSeenInReading, upsertReadingHistory, upsertSavedWord } from '../../lib/data'
import { fetchArticle, fetchYoutubeTranscript } from '../../lib/api'
import { colors } from '../../lib/theme'
import { TextToken, tokenizeText } from '../../lib/tokenize'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { FIRST_SESSION_SAMPLE } from '../../lib/starterContent'
import { markJourneyStep } from '../../lib/journey'
import { setFirstSessionActive } from '../../lib/guest'
import { buildContextBridgeMatches, ContextBridgeMatch } from '../../lib/contextBridge'
import { buildReadingCoach, ReadingCoachWord } from '../../lib/readingCoach'
import { usePremium } from '../../contexts/SubscriptionContext'

type InputMode = 'url' | 'text'
type ReaderMeta = {
  title: string
  sourceType: 'article_url' | 'manual_text' | 'youtube'
  sourceUrl?: string
}

type ReadingCoachState = {
  visible: boolean
  loading: boolean
  items: ReadingCoachWord[]
  text: string
  meta: ReaderMeta | null
}

const sampleText = `Learning a language takes time, but daily exposure makes a remarkable difference. When you read a short article, notice unfamiliar words, and review them later, your brain starts connecting meaning with real context. The process becomes natural over time, especially when you encounter words repeatedly across different sources.`

export default function OkuScreen() {
  const { isPro } = usePremium()
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
  const [showFirstCoach, setShowFirstCoach] = useState(false)
  const [bridgeMatches, setBridgeMatches] = useState<Record<number, ContextBridgeMatch>>({})
  const [coachState, setCoachState] = useState<ReadingCoachState>({
    visible: false,
    loading: false,
    items: [],
    text: '',
    meta: null,
  })
  const params = useLocalSearchParams()
  const { tip, setTip, isSaved, getCacheEntry, openWordTip, saveTip, closeTip, retryTip } = useWordTip()
  const scrollRef = useRef<ScrollView>(null)
  const manualParamKeyRef = useRef<string | null>(null)

  const getSentence = useCallback(
    (index: number) =>
      tokens.slice(Math.max(0, index - 5), index + 6).map((t) => t.val).join(''),
    [tokens],
  )

  const selection = useReaderSelection(tokens, getSentence)
  const sentenceTr = useSentenceTranslate(tokens)

  useEffect(() => {
    const prefill = typeof params.prefillUrl === 'string' ? params.prefillUrl : null
    if (!prefill) return
    setMode('url')
    setUrl(prefill)
    void handleFetchArticleFromUrl(prefill)
  }, [params.prefillUrl])

  useEffect(() => {
    const incomingText = typeof params.manualText === 'string' ? params.manualText.trim() : ''
    if (!incomingText) return

    const incomingTitle = typeof params.manualTitle === 'string' && params.manualTitle.trim()
      ? params.manualTitle.trim()
      : 'Yapıştırılan Metin'
    const key = `${incomingTitle}::${incomingText.slice(0, 120)}`
    if (manualParamKeyRef.current === key) return
    manualParamKeyRef.current = key

    setMode('text')
    setManualTitle(incomingTitle)
    setInput(incomingText)
    void startReadingFlow(incomingText, {
      title: incomingTitle,
      sourceType: 'manual_text',
    }, { skipCoach: true })
  }, [params.manualText, params.manualTitle])

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
    const tokenized = tokenizeText(text)
    setInput(text)
    setTokens(tokenized)
    setReaderMeta(meta)
    setReady(true)
    setError('')
    setScrollProgress(0)
    setCoachState({ visible: false, loading: false, items: [], text: '', meta: null })
    void markJourneyStep('read')
    void hydrateContextBridge(tokenized)
  }

  async function hydrateContextBridge(nextTokens: TextToken[]) {
    try {
      const words = await listSavedWords()
      const matches = buildContextBridgeMatches(nextTokens, words)
      setBridgeMatches(matches)
      await markSavedWordsSeenInReading(Object.values(matches).map((item) => item.savedWordId))
    } catch (bridgeError) {
      console.warn('[oku] hydrateContextBridge failed:', bridgeError)
      setBridgeMatches({})
    }
  }

  function findSentenceForWord(text: string, word: string) {
    const lowered = word.toLowerCase()
    const sentence = text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .find((item) => item.toLowerCase().includes(lowered))
    return sentence?.trim() || text.slice(0, 180).trim()
  }

  async function openCoach(text: string, meta: ReaderMeta) {
    setCoachState({
      visible: true,
      loading: true,
      items: [],
      text,
      meta,
    })
    try {
      const words = await listSavedWords()
      const items = await buildReadingCoach({
        text,
        title: meta.title,
        sourceType: meta.sourceType,
        savedWords: words,
        isPro,
      })
      setCoachState({
        visible: true,
        loading: false,
        items,
        text,
        meta,
      })
    } catch (coachError) {
      console.warn('[oku] openCoach failed:', coachError)
      setCoachState((prev) => ({ ...prev, loading: false }))
    }
  }

  async function startReadingFlow(text: string, meta: ReaderMeta, options?: { skipCoach?: boolean }) {
    openReader(text, meta)
  }

  async function handleCoachContinue(saveRecommendations: boolean) {
    if (!coachState.meta) return
    if (saveRecommendations && coachState.items.length) {
      await Promise.all(
        coachState.items.map((item) =>
          upsertSavedWord({
            word: item.word,
            translation: item.translation,
            cefr: item.cefr,
            ipa: item.ipa,
            source_title: coachState.meta?.title,
            source_url: coachState.meta?.sourceUrl,
            source_type: coachState.meta?.sourceType,
            context_sentence: findSentenceForWord(coachState.text, item.word),
          }),
        ),
      )
    }
    openReader(coachState.text, coachState.meta)
  }

  useEffect(() => {
    if (params.firstSession !== '1') return
    setMode('text')
    setManualTitle(FIRST_SESSION_SAMPLE.title)
    openReader(FIRST_SESSION_SAMPLE.text, {
      title: FIRST_SESSION_SAMPLE.title,
      sourceType: 'manual_text',
    })
    setShowFirstCoach(true)
    void setFirstSessionActive(false)
  }, [params.firstSession])

  async function handleFetchArticleFromUrl(articleUrl: string) {
    setFetching(true)
    setError('')
    try {
      const isYoutube = getSourceType(articleUrl) === 'youtube'
      const data = isYoutube
        ? await fetchYoutubeTranscript(articleUrl)
        : await fetchArticle(articleUrl)
      if (data.text) {
        await startReadingFlow(data.text, {
          title: makeTitleFromUrl(articleUrl),
          sourceType: getSourceType(articleUrl),
          sourceUrl: articleUrl,
        }, { skipCoach: true })
        void saveHistory(articleUrl, data.text)
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
      await upsertReadingHistory({
        url: articleUrl,
        title,
        word_count: text.split(/\s+/).filter(Boolean).length,
      })
    } catch (e) {
      console.warn('[oku] saveHistory failed:', e)
    }
  }

  async function handleFetchArticle() {
    if (!url.trim()) return
    await handleFetchArticleFromUrl(url)
  }

  function handleProcess() {
    if (!input.trim()) return
    void startReadingFlow(input, {
      title: manualTitle.trim() || 'Yapıştırılan Metin',
      sourceType: 'manual_text',
    }, { skipCoach: true })
  }

  function loadSample() {
    setMode('text')
    setManualTitle('Günlük İngilizce Pratiği')
    setInput(sampleText)
    setError('')
    void startReadingFlow(sampleText, {
      title: 'Günlük İngilizce Pratiği',
      sourceType: 'manual_text',
    }, { skipCoach: true })
  }

  const wordCount = tokens.filter((token) => token.word).length
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200))

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
              { icon: 'hand-left-outline', text: 'Dokun → kelime · basılı tut → cümle çevirisi' },
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
      ) : coachState.visible ? (
        <ScrollView contentContainerStyle={styles.inputArea}>
          <Text style={styles.title}>Reading Coach</Text>
          <Text style={styles.subtitle}>
            Okumaya başlamadan önce bu içerikte sık karşılaşabileceğin birkaç kelimeyi öne çıkardım.
          </Text>

          <View style={styles.coachHeroCard}>
            <Text style={styles.coachHeroEyebrow}>ÖN OKUMA</Text>
            <Text style={styles.coachHeroTitle}>{coachState.meta?.title || 'Bu içerik için öneriler'}</Text>
            <Text style={styles.coachHeroText}>
              Bu kelimeleri şimdi kaydedersen okurken daha çok “ben bunu biliyorum” anı yaşayacaksın.
            </Text>
          </View>

          {coachState.loading ? (
            <View style={styles.coachLoading}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.helperText}>Önerilen kelimeleri hazırlıyorum...</Text>
            </View>
          ) : (
            <View style={styles.coachWordList}>
              {coachState.items.map((item) => (
                <View key={item.word} style={styles.coachWordCard}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.coachWordTop}>
                      <Text style={styles.coachWord}>{item.word}</Text>
                      {item.cefr ? (
                        <View style={styles.coachCefrBadge}>
                          <Text style={styles.coachCefrText}>{item.cefr}</Text>
                        </View>
                      ) : null}
                    </View>
                    {item.translation ? <Text style={styles.coachTranslation}>{item.translation}</Text> : null}
                    <Text style={styles.coachReason}>{item.reason}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.processBtn, coachState.loading && { opacity: 0.5 }]}
            disabled={coachState.loading}
            onPress={() => { void handleCoachContinue(true) }}
          >
            <Text style={styles.processBtnText}>Önerileri Kaydet ve Oku</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sampleBtn}
            onPress={() => { void handleCoachContinue(false) }}
            disabled={coachState.loading}
          >
            <Text style={styles.sampleBtnText}>Direkt Okumaya Geç</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          {showFirstCoach ? (
            <View style={styles.coachBanner}>
              <Ionicons name="hand-left-outline" size={18} color={colors.accent} />
              <Text style={styles.coachText}>
                <Text style={styles.coachBold}>Dokun</Text> → kelime ·{' '}
                <Text style={styles.coachBold}>Basılı tut</Text> → cümle çevirisi ·{' '}
                <Text style={styles.coachBold}>Kaydet</Text> ile listene ekle.
              </Text>
              <TouchableOpacity onPress={() => setShowFirstCoach(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.readerHeader}>
            <TouchableOpacity
              onPress={() => { selection.exitSelection(); setReady(false); setShowFirstCoach(false) }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.readerTitleSmall} numberOfLines={1}>{readerMeta?.title || 'Okuma'}</Text>
              <Text style={styles.readerMeta}>{wordCount} kelime · ~{readingMinutes} dk</Text>
            </View>
            <TouchableOpacity
              style={[styles.selectModeBtn, selection.selectionMode && styles.selectModeBtnActive]}
              onPress={() => {
                if (selection.selectionMode) selection.exitSelection()
                else selection.enterSelection(0)
                sentenceTr.close()
              }}
              hitSlop={8}
            >
              <Ionicons
                name={selection.selectionMode ? 'close' : 'checkbox-outline'}
                size={20}
                color={selection.selectionMode ? colors.text : colors.accent}
              />
            </TouchableOpacity>
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
              <Text style={styles.readerHint}>
                {selection.selectionMode
                  ? 'Kelimelere dokunarak seç · alttan Çevir'
                  : 'Dokun → kelime · basılı tut → cümle çevirisi'}
              </Text>
            </View>

            <SelectableReaderText
              tokens={tokens}
              selectionMode={selection.selectionMode}
              isSelected={selection.isSelected}
              isInSentence={sentenceTr.isInHighlightedSentence}
              activeWord={tip?.word}
              getCacheEntry={getCacheEntry}
              cefrHighlight={cefrHighlight}
              contextBridgeMatches={bridgeMatches}
              onWordPress={(i) =>
                selection.handleWordPress(i, () => {
                  sentenceTr.close()
                  const span = getSentenceSpan(tokens, i)
                  void openWordTip(tokens[i].val, span?.text ?? getSentence(i)).then(() => {
                    const match = bridgeMatches[i]
                    if (match) {
                      setTip((prev) => prev ? ({
                        ...prev,
                        reunion: {
                          sourceTitle: match.sourceTitle,
                          translation: match.translation,
                          savedAt: match.savedAt,
                        },
                      }) : prev)
                    }
                  })
                })
              }
              onWordLongPress={(i) => {
                closeTip()
                selection.exitSelection()
                void sentenceTr.translateAt(i)
              }}
            />

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
              <Text style={styles.bridgeHint}>Sarı vurgular, daha önce kaydettiğin kelimelerin bu metindeki ilk buluşmalarıdır.</Text>
            </View>
          </ScrollView>

          <SelectionToolbar
            visible={selection.selectionMode}
            count={selection.count}
            translating={selection.translating}
            onClear={selection.clearSelection}
            onTranslate={selection.translateSelected}
            onClose={selection.exitSelection}
          />
        </>
      )}

      <BatchTranslationSheet
        visible={selection.sheetVisible}
        items={selection.translations}
        loading={selection.translating}
        onClose={() => selection.setSheetVisible(false)}
      />

      <SentenceTranslationSheet
        visible={sentenceTr.visible}
        original={sentenceTr.span?.text ?? null}
        translation={sentenceTr.tr}
        loading={sentenceTr.loading}
        error={sentenceTr.error}
        onClose={sentenceTr.close}
        onRetry={() => {
          if (sentenceTr.span) {
            const mid = Math.floor((sentenceTr.span.start + sentenceTr.span.end) / 2)
            void sentenceTr.translateAt(mid)
          }
        }}
      />

      <WordTipSheet
        tip={tip}
        saved={isSaved}
        onClose={closeTip}
        onRetry={retryTip}
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
  coachHeroCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  coachHeroEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 },
  coachHeroTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  coachHeroText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  coachLoading: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  coachWordList: { gap: 10, marginBottom: 16 },
  coachWordCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  coachWordTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  coachWord: { color: colors.text, fontSize: 18, fontWeight: '800' },
  coachCefrBadge: { backgroundColor: colors.accentDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  coachCefrText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  coachTranslation: { color: colors.accent, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  coachReason: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  coachBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.accentDim,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.28)',
  },
  coachText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  coachBold: { color: colors.accent, fontWeight: '800' },
  selectModeBtn: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  selectModeBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  readerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  readerTitleSmall: { color: colors.text, fontSize: 15, fontWeight: '700' },
  readerMeta: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  progressBar: { height: 3, backgroundColor: '#1a1a1a' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  readArea: { padding: 20, paddingBottom: 100 },
  metaChips: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  readerMetaChip: { backgroundColor: colors.accentDim, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  readerMetaChipText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  readerHint: { color: colors.textMuted, fontSize: 12 },
  cefrLegend: { marginTop: 32, padding: 14, backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  legendTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14 },
  legendText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  bridgeHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 10 },
})
