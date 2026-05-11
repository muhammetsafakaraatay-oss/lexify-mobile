import { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import YoutubePlayer from 'react-native-youtube-iframe'
import { WordTipSheet } from '../../components/WordTipSheet'
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

export default function VideoScreen() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [videoId, setVideoId] = useState('')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const playerRef = useRef<any>(null)
  const videoRef = useRef<any>(null)
  const scrollRef = useRef<ScrollView>(null)
  const { tip, isSaved, openWordTip, saveTip, closeTip } = useWordTip()

  async function handleFetch() {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchYoutubeTranscript(url)
      const normalizedSegments = normalizeTranscript(data)
      if (normalizedSegments.length > 0) {
        setSegments(normalizedSegments)
        setVideoId(data.videoId || '')
      } else {
        setError('Transcript alınamadı. Farklı bir YouTube videosu deneyin.')
      }
    } catch (e) {
      console.error(e)
      setError('Video işlenemedi. Linki ve altyazı durumunu kontrol edin.')
    }
    finally { setLoading(false) }
  }

  function getCurrentSegmentIndex() {
    const ms = currentTime * 1000
    for (let i = segments.length - 1; i >= 0; i--) {
      if (ms >= segments[i].offset) return i
    }
    return 0
  }

  async function seekTo(offsetMs: number) {
    await videoRef.current?.setPositionAsync(offsetMs)
  }

  const activeIdx = getCurrentSegmentIndex()

  useEffect(() => {
    if (activeIdx > 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: activeIdx * 72, animated: true })
    }
  }, [activeIdx])

  return (
    <SafeAreaView style={styles.container}>
      {!videoId ? (
        <View style={styles.inputArea}>
          <Text style={styles.title}>Video<Text style={{ color: colors.accent }}>.</Text></Text>
          <Text style={styles.subtitle}>YouTube linkini yapıştır, transcript üzerinden kelime öğren.</Text>

          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              placeholder="YouTube URL gir..."
              placeholderTextColor={colors.textMuted}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity style={styles.urlBtn} onPress={handleFetch} disabled={loading}>
              {loading
                ? <ActivityIndicator color={colors.bg} size="small" />
                : <Ionicons name="arrow-forward" size={20} color={colors.bg} />
              }
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={16} color="#f87171" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            {[
              { icon: 'logo-youtube', text: 'YouTube linkini yapıştır' },
              { icon: 'hand-left-outline', text: 'Transcript\'e kelimeye dokun' },
              { icon: 'bookmark-outline', text: 'Kaydet ve flashcard\'a ekle' },
            ].map(({ icon, text }) => (
              <View key={icon} style={styles.infoRow}>
                <Ionicons name={icon as any} size={15} color={colors.accent} />
                <Text style={styles.infoText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <YoutubePlayer
            ref={playerRef}
            height={220}
            videoId={videoId}
            onChangeState={async (state: string) => {
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

          <TouchableOpacity style={styles.backBtn} onPress={() => { setVideoId(''); setSegments([]) }}>
            <Text style={styles.backBtnText}>← Geri</Text>
          </TouchableOpacity>

          <ScrollView ref={scrollRef} style={styles.transcript} contentContainerStyle={{ padding: 16, gap: 8 }}>
            {segments.map((seg, idx) => (
              <TouchableOpacity key={idx} onPress={() => seekTo(seg.offset)} style={[styles.segmentRow, idx === activeIdx && styles.activeSegment]}>
                <Text style={styles.segmentTime}>{Math.floor(seg.offset / 60000)}:{String(Math.floor((seg.offset % 60000) / 1000)).padStart(2, '0')}</Text>
                <Text style={styles.segmentText}>
                  {tokenizeText(seg.text).map((t, ti) =>
                    t.word ? (
                      <Text
                        key={ti}
                        onPress={() => openWordTip(t.val, seg.text)}
                        style={[styles.word, idx === activeIdx && styles.activeWord]}
                      >
                        {t.val}
                      </Text>
                    ) : (
                      <Text key={ti}>{t.val}</Text>
                    )
                  )}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <WordTipSheet
        tip={tip}
        saved={isSaved}
        onClose={closeTip}
        onSave={() => saveTip()}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inputArea: { flex: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 36, fontWeight: '800', color: colors.text, marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  urlRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.24)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#fda4af', flex: 1, fontSize: 13, lineHeight: 19 },
  infoCard: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: colors.textMuted, fontSize: 13 },
  urlInput: { flex: 1, backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  urlBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', width: 48 },
  video: { width: '100%', height: 220, backgroundColor: '#000' },
  backBtn: { padding: 12 },
  backBtnText: { color: colors.accent, fontSize: 15 },
  transcript: { flex: 1 },
  segmentRow: { flexDirection: 'row', gap: 8, padding: 8, borderRadius: 8 },
  activeSegment: { backgroundColor: 'rgba(250,204,21,0.08)' },
  segmentTime: { color: colors.textMuted, fontSize: 11, width: 36, marginTop: 2 },
  segmentText: { flex: 1, fontSize: 15, lineHeight: 24, color: colors.textDim },
  word: { color: colors.text },
  activeWord: { color: colors.accent },
})
