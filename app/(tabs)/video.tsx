import { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import YoutubePlayer from 'react-native-youtube-iframe'
import { WordTipSheet } from '../../components/WordTipSheet'
import { fetchYoutubeTranscript, TranscriptSegment } from '../../lib/api'
import { useWordTip } from '../../hooks/useWordTip'
import { colors } from '../../lib/theme'
import { tokenizeText } from '../../lib/tokenize'

export default function VideoScreen() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
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
    try {
      const data = await fetchYoutubeTranscript(url)
      if (data.segments) {
        setSegments(data.segments)
        setVideoId(data.videoId || '')
      }
    } catch (e) { console.error(e) }
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
          <Text style={styles.title}>Video Oku</Text>
          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              placeholder="YouTube URL..."
              placeholderTextColor={colors.textMuted}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.urlBtn} onPress={handleFetch} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.urlBtnText}>Getir</Text>}
            </TouchableOpacity>
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
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 24 },
  urlRow: { flexDirection: 'row', gap: 8 },
  urlInput: { flex: 1, backgroundColor: colors.bgSurface, borderRadius: 10, padding: 12, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  urlBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  urlBtnText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
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
