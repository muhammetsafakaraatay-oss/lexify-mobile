import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { WordTipSheet } from '../../components/WordTipSheet'
import { processOcr } from '../../lib/api'
import { useWordTip } from '../../hooks/useWordTip'
import { colors } from '../../lib/theme'
import { TextToken, tokenizeText } from '../../lib/tokenize'

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<'camera' | 'result'>('camera')
  const [processing, setProcessing] = useState(false)
  const [tokens, setTokens] = useState<TextToken[]>([])
  const cameraRef = useRef<CameraView>(null)
  const { tip, isSaved, openWordTip, saveTip, closeTip } = useWordTip()

  async function processImage(base64: string, uri?: string) {
    setProcessing(true)
    try {
      const data = await processOcr(base64)
      if (data.text?.trim()) {
        setTokens(tokenizeText(data.text))
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
        <TouchableOpacity onPress={() => { setMode('camera'); setTokens([]) }} style={styles.backBtnWrap}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tanınan Metin</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.textArea}>
        <Text style={styles.readText}>
          {tokens.map((t, i) =>
            t.word ? (
              <Text key={i} onPress={() => openWordTip(t.val, t.val)} style={styles.word}>{t.val}</Text>
            ) : (
              <Text key={i} style={styles.punct}>{t.val}</Text>
            )
          )}
        </Text>
      </ScrollView>

      <WordTipSheet
        tip={tip}
        saved={isSaved}
        onClose={closeTip}
        onSave={() => saveTip()}
      />
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>Kamera ile Tara</Text>
        <View style={{ width: 40 }} />
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
  backBtnWrap: { padding: 4 },
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
})
