import { useEffect, useMemo, useRef, useState } from 'react'
import { PremiumGate } from '../../components/PremiumGate'
import { usePremium } from '../../contexts/SubscriptionContext'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import YoutubePlayer from 'react-native-youtube-iframe'
import { WordTipSheet } from '../../components/WordTipSheet'
import { ReaderBlock } from '../../components/reader/ReaderBlock'
import { fetchYoutubeTranscript, TranscriptPayload, TranscriptSegment } from '../../lib/api'
import { useWordTip } from '../../hooks/useWordTip'
import { colors } from '../../lib/theme'
import { tokenizeText } from '../../lib/tokenize'
import { Ionicons } from '@expo/vector-icons'

const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+|\n+/g
const MAX_SEGMENT_CHARS = 220

function splitLongText(text: string) {
  const chunks: string[] = []
  const sentences = text
    .split(SENTENCE_SPLIT_REGEX)
    .map((part) => part.trim())
    .filter(Boolean)

  if (sentences.length === 0) {
    return text
      .match(new RegExp(`.{1,${MAX_SEGMENT_CHARS}}`, 'g'))
      ?.map((part) => part.trim())
      .filter(Boolean) ?? []
  }

  let buffer = ''
  for (const sentence of sentences) {
    const candidate = buffer ? `${buffer} ${sentence}` : sentence
    if (candidate.length <= MAX_SEGMENT_CHARS) {
      buffer = candidate
      continue
    }

    if (buffer) chunks.push(buffer)
    if (sentence.length <= MAX_SEGMENT_CHARS) {
      buffer = sentence
      continue
    }

    const hardParts = sentence
      .match(new RegExp(`.{1,${MAX_SEGMENT_CHARS}}`, 'g'))
      ?.map((part) => part.trim())
      .filter(Boolean) ?? []
    chunks.push(...hardParts)
    buffer = ''
  }

  if (buffer) chunks.push(buffer)
  return chunks
}

function normalizeTranscript(payload: TranscriptPayload): TranscriptSegment[] {
  const rawSegments = payload.segments ?? []

  if (rawSegments.length > 0) {
    const normalized: TranscriptSegment[] = []

    for (const segment of rawSegments) {
      const pieces = splitLongText(segment.text)
      if (pieces.length <= 1) {
        normalized.push(segment)
        continue
      }

      const sliceDuration = Math.max(1200, Math.floor(segment.duration / pieces.length))
      pieces.forEach((piece, index) => {
        normalized.push({
          text: piece,
          offset: segment.offset + (sliceDuration * index),
          duration: sliceDuration,
        })
      })
    }

    return normalized
  }

  const fullText = payload.text?.trim()
  if (!fullText) return []

  const pieces = splitLongText(fullText)
  return pieces.map((piece, index) => ({
    text: piece,
    offset: index * 4000,
    duration: 4000,
  }))
}

function formatTimestamp(offsetMs: number) {
  const totalSeconds = Math.floor(offsetMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function deriveVideoLabel(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '')
  } catch {
    return 'YouTube'
  }
}

export default function VideoScreen() {
  const { isPro, isLoading: subLoading } = usePremium()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [videoId, setVideoId] = useState('')
  const [sourceLabel, setSourceLabel] = useState('YouTube')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const playerRef = useRef<any>(null)
  const scrollRef = useRef<ScrollView>(null)
  const { tip, isSaved, openWordTip, saveTip, closeTip } = useWordTip()

  async function handleFetch(candidate?: string) {
    const value = (candidate ?? url).trim()
    if (!value) return

    setLoading(true)
    setError('')
    try {
      const data = await fetchYoutubeTranscript(value)
      const normalizedSegments = normalizeTranscript(data)
      if (normalizedSegments.length > 0) {
        setUrl(value)
        setSegments(normalizedSegments)
        setVideoId(data.videoId || '')
        setSourceLabel(deriveVideoLabel(value))
      } else {
        setError('Transcript alınamadı. Farklı bir YouTube videosu deneyin.')
      }
    } catch (e) {
      console.error(e)
      setError('Video işlenemedi. Linki ve altyazı durumunu kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  function resetVideo() {
    setVideoId('')
    setSegments([])
    setCurrentTime(0)
    setError('')
  }

  function getCurrentSegmentIndex() {
    const ms = currentTime * 1000
    for (let i = segments.length - 1; i >= 0; i--) {
      if (ms >= segments[i].offset) return i
    }
    return 0
  }

  async function seekTo(offsetMs: number) {
    const seconds = Math.floor(offsetMs / 1000)
    try {
      await playerRef.current?.seekTo(seconds, true)
      setCurrentTime(seconds)
    } catch (e) {
      console.warn('[video] seek failed:', e)
    }
  }

  const activeIdx = getCurrentSegmentIndex()
  const activeSegment = segments[activeIdx]

  useEffect(() => {
    if (activeIdx > 1 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, activeIdx - 1) * 84, animated: true })
    }
  }, [activeIdx])

  const transcriptStats = useMemo(() => {
    const wordCount = segments.reduce((sum, seg) => sum + tokenizeText(seg.text).filter((t) => t.word).length, 0)
    const durationSec = segments.length > 0
      ? Math.ceil((segments[segments.length - 1].offset + segments[segments.length - 1].duration) / 1000)
      : 0
    return {
      segments: segments.length,
      words: wordCount,
      minutes: Math.max(1, Math.ceil(wordCount / 160)),
      durationLabel: `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`,
    }
  }, [segments])

  if (subLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!isPro) {
    return (
      <PremiumGate
        feature="video"
        title="Video ile öğren"
        description="YouTube transcript üzerinden kelimeye dokun, videoyu durdurmadan anlamını gör ve kaydet."
      />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {!videoId ? (
        <ScrollView contentContainerStyle={styles.inputArea}>
          <Text style={styles.eyebrow}>VIDEO LAB</Text>
          <Text style={styles.title}>Video<Text style={{ color: colors.accent }}>.</Text></Text>
          <Text style={styles.subtitle}>
            YouTube linkini yapıştır, transcript’i temiz bölümler halinde aç, sonra kelimelere dokunup doğrudan çalışma akışına ekle.
          </Text>

          <View style={styles.valueRow}>
            {[
              { label: 'TRANSCRIPT', value: 'Segmentli' },
              { label: 'SAVE', value: '1 dokunuş' },
              { label: 'REVIEW', value: 'Flashcard' },
            ].map((item) => (
              <View key={item.label} style={styles.valueCard}>
                <Text style={styles.valueLabel}>{item.label}</Text>
                <Text style={styles.valueValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.urlCard}>
            <Text style={styles.urlCardTitle}>YouTube videosunu içeri al</Text>
            <Text style={styles.urlCardHint}>
              Altyazısı olan bir video ekle; transcript otomatik ayrıştırılır ve dokunulabilir hale gelir.
            </Text>

            <View style={styles.urlRow}>
              <TextInput
                style={styles.urlInput}
                placeholder="https://www.youtube.com/watch?v=..."
                placeholderTextColor={colors.textMuted}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => handleFetch()}
              />
              <TouchableOpacity style={styles.urlBtn} onPress={() => handleFetch()} disabled={loading} activeOpacity={0.85}>
                {loading ? (
                  <ActivityIndicator color={colors.bg} size="small" />
                ) : (
                  <Ionicons name="arrow-forward" size={20} color={colors.bg} />
                )}
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={16} color="#f87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.infoCard}>
            {[
              { icon: 'logo-youtube', text: 'Linki getir, transcript otomatik parçalansın' },
              { icon: 'time-outline', text: 'Zamana dokunup videoda o ana sıçra' },
              { icon: 'hand-left-outline', text: 'Kelimeye dokun, anlamını gör ve kaydet' },
            ].map(({ icon, text }) => (
              <View key={icon} style={styles.infoRow}>
                <Ionicons name={icon as any} size={16} color={colors.accent} />
                <Text style={styles.infoText}>{text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.playerScreen}>
          <View style={styles.playerHeader}>
            <View>
              <Text style={styles.playerEyebrow}>TRANSCRIPT MODE</Text>
              <Text style={styles.playerTitle}>{sourceLabel}</Text>
            </View>
            <TouchableOpacity style={styles.backBtn} onPress={resetVideo}>
              <Ionicons name="arrow-back" size={18} color={colors.text} />
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.videoCard}>
            <YoutubePlayer
              ref={playerRef}
              height={220}
              videoId={videoId}
              onChangeState={(state: string) => {
                if (state === 'playing') {
                  const interval = setInterval(async () => {
                    const t = await playerRef.current?.getCurrentTime()
                    if (t !== undefined) setCurrentTime(t)
                  }, 500)
                  playerRef.current._interval = interval
                } else {
                  clearInterval(playerRef.current?._interval)
                }
              }}
            />
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>segment</Text>
              <Text style={styles.summaryValue}>{transcriptStats.segments}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>kelime</Text>
              <Text style={styles.summaryValue}>{transcriptStats.words}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>süre</Text>
              <Text style={styles.summaryValue}>{transcriptStats.durationLabel}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>okuma</Text>
              <Text style={styles.summaryValue}>~{transcriptStats.minutes} dk</Text>
            </View>
          </View>

          {activeSegment ? (
            <View style={styles.activeCard}>
              <Text style={styles.activeLabel}>AKTİF SATIR</Text>
              <Text style={styles.activeText} numberOfLines={3}>{activeSegment.text}</Text>
            </View>
          ) : null}

          <ScrollView ref={scrollRef} style={styles.transcript} contentContainerStyle={styles.transcriptContent}>
            {segments.map((seg, idx) => (
              <View
                key={`${seg.offset}-${idx}`}
                style={[styles.segmentRow, idx === activeIdx && styles.activeSegment]}
              >
                <TouchableOpacity
                  onPress={() => seekTo(seg.offset)}
                  activeOpacity={0.82}
                  style={styles.segmentTimeWrap}
                >
                  <Text style={[styles.segmentTime, idx === activeIdx && styles.activeSegmentTime]}>
                    {formatTimestamp(seg.offset)}
                  </Text>
                </TouchableOpacity>
                <View style={styles.segmentTextWrap}>
                  <ReaderBlock
                    text={seg.text}
                    onWordTap={(word) => openWordTip(word, seg.text)}
                    activeWord={tip?.word}
                    showToolbar={false}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <WordTipSheet
        tip={tip}
        saved={isSaved}
        onClose={closeTip}
        onSave={() => saveTip({
          context: tip?.context,
          sourceTitle: sourceLabel,
          sourceUrl: url,
          sourceType: 'youtube',
        })}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inputArea: { padding: 24, paddingTop: 48, paddingBottom: 40 },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  title: { fontSize: 36, fontWeight: '800', color: colors.text, marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 22 },
  valueRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  valueCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  valueLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  valueValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  urlCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  urlCardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  urlCardHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  urlRow: { flexDirection: 'row', gap: 8 },
  urlInput: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  urlBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.24)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  errorText: { color: '#fda4af', flex: 1, fontSize: 13, lineHeight: 19 },
  infoCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: colors.textMuted, fontSize: 13, lineHeight: 18, flex: 1 },

  playerScreen: { flex: 1, paddingTop: 12 },
  playerHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  playerTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  videoCard: {
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  summaryLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  summaryValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  activeCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(250,204,21,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.18)',
    borderRadius: 14,
    padding: 14,
  },
  activeLabel: { color: colors.accent, fontSize: 10, fontWeight: '800', marginBottom: 6, letterSpacing: 1 },
  activeText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  transcript: { flex: 1 },
  transcriptContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeSegment: {
    backgroundColor: 'rgba(250,204,21,0.08)',
    borderColor: 'rgba(250,204,21,0.24)',
  },
  segmentTimeWrap: {
    width: 48,
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  segmentTime: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  activeSegmentTime: { color: colors.accent },
  segmentTextWrap: { flex: 1 },
  segmentText: { flex: 1, fontSize: 15, lineHeight: 24, color: colors.textDim },
  word: { color: colors.text },
  activeWord: { color: colors.accent },
  punct: { color: colors.textDim },
})
