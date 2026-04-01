import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Modal, Pressable
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { translateWord } from '../../lib/api'
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

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<'camera' | 'result'>('camera')
  const [processing, setProcessing] = useState(false)
  const [tokens, setTokens] = useState<{ word: boolean; val: string }[]>([])
  const [tip, setTip] = useState<any>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const cameraRef = useRef<CameraView>(null)
  const cache = useRef<Record<string, any>>({})

  const cefrColor: Record<string, string> = {
    A1: '#4ade80', A2: '#86efac', B1: '#facc15', B2: '#fb923c', C1: '#f87171', C2: '#e879f9'
  }

  async function processImage(base64: string, uri?: string) {
    setProcessing(true)
    try {
      const res = await fetch('https://lexitr.vercel.app/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await res.json()
      if (data.text?.trim()) {
        setTokens(tokenize(data.text))
        setMode('result')
      }
    } catch (e) { console.error(e) }
    finally { setProcessing(false) }
  }

  async function takePicture() {
    if (!cameraRef.current) return
    setProcessing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 })
      if (photo?.uri) await processImage(photo.base64 || '', photo.uri)
    } catch (e) { setProcessing(false) }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, quality: 0.7,
    })
    if (!result.canceled && result.assets[0].uri) {
      await processImage(result.assets[0].base64 || '', result.assets[0].uri)
    }
  }

  async function handleWordPress(word: string) {
    const k = word.toLowerCase()
    if (cache.current[k]) { setTip({ word, ...cache.current[k] }); return }
    setTip({ word, loading: true })
    const data = await translateWord(word, word)
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

  if (!permission) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>

  if (!permission.granted) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.permText}>Kamera izni gerekli</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  if (mode === 'result') return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setMode('camera'); setTokens([]) }}>
          <Text style={styles.backBtn}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tanınan Metin</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.textArea}>
        <Text style={styles.readText}>
          {tokens.map((t, i) =>
            t.word ? (
              <Text key={i} onPress={() => handleWordPress(t.val)} style={styles.word}>{t.val}</Text>
            ) : (
              <Text key={i} style={styles.punct}>{t.val}</Text>
            )
          )}
        </Text>
      </ScrollView>

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📷 Kamera ile Tara</Text>
      </View>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.overlay}>
          <View style={styles.scanBox} />
          <Text style={styles.scanHint}>Metni çerçeve içine al</Text>
        </View>
      </CameraView>
      <View style={styles.controls}>
        {processing ? (
          <ActivityIndicator color={colors.accent} size="large" />
        ) : (
          <>
            <TouchableOpacity style={styles.galleryBtn} onPress={pickImage}>
              <Text style={styles.galleryText}>🖼 Galeri</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <View style={{ width: 80 }} />
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.bg },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  backBtn: { color: colors.accent, fontSize: 16 },
  camera: { flex: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanBox: { width: 280, height: 180, borderWidth: 2, borderColor: colors.accent, borderRadius: 12 },
  scanHint: { color: '#fff', marginTop: 16, fontSize: 14, opacity: 0.8 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 32, backgroundColor: '#000' },
  galleryBtn: { width: 80, alignItems: 'center' },
  galleryText: { color: '#fff', fontSize: 13 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000' },
  textArea: { padding: 20 },
  readText: { fontSize: 17, lineHeight: 30, color: colors.text },
  word: { color: colors.text },
  punct: { color: colors.text },
  permText: { color: colors.text, fontSize: 18, marginBottom: 16 },
  permBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, paddingHorizontal: 24 },
  permBtnText: { color: colors.bg, fontWeight: '700' },
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
