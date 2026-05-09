import { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Modal, Pressable, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { translateWord } from '../../lib/api'
import { colors } from '../../lib/theme'
import * as Speech from 'expo-speech'

const YoutubePlayer: React.ComponentType<any> = Platform.OS !== 'web'
  ? require('react-native-youtube-iframe').default
  : () => null

interface Segment {
  text: string
  offset: number
  duration: number
}

export default function VideoScreen() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [videoId, setVideoId] = useState('')
  const [segments, setSegments] = useState<Segment[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [tip, setTip] = useState<any>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const playerRef = useRef<any>(null)
  const videoRef = useRef<any>(null)
  const cache = useRef<Record<string, any>>({})
  const scrollRef = useRef<ScrollView>(null)

  const cefrColor: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  async function handleFetch() {
    if (!url.trim()) return
    setLoading(true)
    try {
      const res = await fetch('https://lexitr.vercel.app/api/youtube-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.segments) {
        setSegments(data.segments)
        setVideoId(data.videoId)
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
    await supabase.from('saved_words').upsert({
      user_id: user.id, word: tip.word,
      translation: tip.tr, context: tip.context, cefr: tip.cefr
    }, { onConflict: 'user_id,word' })
    setSaved(p => ({ ...p, [k]: true }))
  }

  const activeIdx = getCurrentSegmentIndex()

  useEffect(() => {
    if (activeIdx > 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: activeIdx * 72, animated: true })
    }
  }, [activeIdx])

  function tokenizeSegment(text: string) {
    const out: { word: boolean; val: string }[] = []
    const re = /([a-zA-Z]+)|([^a-zA-Z]+)/g
    let m
    while ((m = re.exec(text)) !== null) {
      if (m[1]) out.push({ word: true, val: m[1] })
      else out.push({ word: false, val: m[2] })
    }
    return out
  }

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
                  {tokenizeSegment(seg.text).map((t, ti) =>
                    t.word ? (
                      <Text
                        key={ti}
                        onPress={() => handleWordPress(t.val, seg.text)}
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

      <Modal visible={!!tip} transparent animationType="slide" onRequestClose={() => setTip(null)}>
        <Pressable style={styles.modalBg} onPress={() => setTip(null)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {tip?.loading ? (
              <ActivityIndicator color={colors.accent} style={{ margin: 32 }} />
            ) : tip ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={styles.sheetWord}>{tip.word}</Text>
                  {tip.cefr && (
                    <View style={[styles.cefrBadge, { borderColor: cefrColor[tip.cefr] }]}>
                      <Text style={[styles.cefrText, { color: cefrColor[tip.cefr] }]}>{tip.cefr}</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => Speech.speak(tip.word, { language: 'en-US', rate: 0.8 })} style={{ marginLeft: 'auto' }}>
                    <Text style={{ fontSize: 24 }}>🔊</Text>
                  </TouchableOpacity>
                </View>
                {tip.ipa ? <Text style={styles.ipa}>{tip.ipa}</Text> : null}
                <Text style={styles.translation}>{tip.tr}</Text>
                {tip.context ? <Text style={styles.context}>{tip.context}</Text> : null}
                <TouchableOpacity
                  style={[styles.saveBtn, saved[tip.word?.toLowerCase()] && styles.saveBtnSaved]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveBtnText}>{saved[tip.word?.toLowerCase()] ? '✓ Kaydedildi' : '+ Kaydet'}</Text>
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
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetWord: { fontSize: 26, fontWeight: '800', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cefrText: { fontSize: 11, fontWeight: '700' },
  ipa: { color: colors.textMuted, fontSize: 14, marginBottom: 6 },
  translation: { fontSize: 20, color: colors.accent, fontWeight: '600', marginBottom: 8 },
  context: { color: colors.textMuted, fontSize: 14, marginBottom: 12, lineHeight: 20 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnSaved: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: colors.border },
  saveBtnText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
})
