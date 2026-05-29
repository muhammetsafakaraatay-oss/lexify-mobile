import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Audio } from 'expo-av'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import { CountdownTimer } from '../../../components/voice/CountdownTimer'
import { WaveformAnimation } from '../../../components/voice/WaveformAnimation'
import { getVoiceDraft, updateVoiceDraft } from '../../../lib/voice'

const RECORD_SECONDS = 30

export default function VoiceEchoRecordingScreen() {
  const router = useRouter()
  const [phase, setPhase] = useState<'countdown' | 'recording' | 'finishing'>('countdown')
  const [countdown, setCountdown] = useState(3)
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS)
  const [meterLevel, setMeterLevel] = useState(0.18)
  const [promptText, setPromptText] = useState('')
  const recordingRef = useRef<Audio.Recording | null>(null)
  const finishingRef = useRef(false)

  useEffect(() => {
    void (async () => {
      const draft = await getVoiceDraft()
      if (!draft) {
        router.replace('/(tabs)/sesli')
        return
      }
      setPromptText(draft.promptText)
    })()
  }, [router])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      void startRecording()
      return
    }
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, phase])

  useEffect(() => {
    if (phase !== 'recording') return
    const timer = setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          void stopRecording()
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    return () => {
      void stopRecording(true)
    }
  }, [])

  async function ensurePermission() {
    const permission = await Audio.requestPermissionsAsync()
    if (permission.status === 'granted') return true

    Alert.alert(
      'Mikrofon izni gerekli',
      'Sesli pratik icin mikrofona ihtiyacimiz var. Ayarlardan izin verebilirsin.',
      [
        { text: 'Vazgec', style: 'cancel', onPress: () => router.back() },
        { text: 'Ayarlari Ac', onPress: () => Linking.openSettings() },
      ],
    )
    return false
  }

  async function startRecording() {
    if (!(await ensurePermission())) return
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      } as any)
      recording.setOnRecordingStatusUpdate((status: any) => {
        if (status?.isRecording) {
          const metering = typeof status.metering === 'number' ? status.metering : -52
          const normalized = Math.max(0.08, Math.min(1, (metering + 60) / 60))
          setMeterLevel(normalized)
        }
      })
      await recording.startAsync()
      recordingRef.current = recording
      setPhase('recording')
    } catch (error) {
      console.warn('[voice] startRecording failed:', error)
      Alert.alert('Kayit baslamadi', 'Mikrofon baslatilamadi. Tekrar dene.')
      router.back()
    }
  }

  async function stopRecording(silent = false) {
    if (finishingRef.current) return
    if (!recordingRef.current) return

    finishingRef.current = true
    setPhase('finishing')

    try {
      const recording = recordingRef.current
      const status = await recording.getStatusAsync()
      if ((status as any)?.isRecording) {
        await recording.stopAndUnloadAsync()
      }
      const uri = recording.getURI()
      if (!uri) throw new Error('Kayit dosyasi olusmadi.')

      const duration = Number((status as any)?.durationMillis ?? (RECORD_SECONDS - secondsLeft) * 1000)
      if (!silent && duration < 5000) {
        Alert.alert('Cok kisa oldu', 'Daha uzun konusursan daha iyi feedback alirsin.')
        await updateVoiceDraft({ audioUri: undefined, audioDurationMs: undefined })
        router.replace('/(tabs)/sesli')
        return
      }

      await updateVoiceDraft({
        audioUri: uri,
        audioDurationMs: duration,
      })
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      })
      if (!silent) {
        router.replace('/(tabs)/sesli/processing')
      }
    } catch (error) {
      console.warn('[voice] stopRecording failed:', error)
      if (!silent) {
        Alert.alert('Kayit tamamlanamadi', 'Bu denemeyi bitiremedik. Tekrar deneyebilirsin.')
        router.replace('/(tabs)/sesli')
      }
    } finally {
      recordingRef.current = null
      finishingRef.current = false
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>VOICE ECHO</Text>
        <Text style={styles.title}>
          {phase === 'countdown' ? 'Hazir ol' : phase === 'recording' ? 'Konusmaya basla' : 'Kayit tamamlanıyor'}
        </Text>
        <Text style={styles.subtitle}>{promptText}</Text>

        <View style={styles.visualCard}>
          {phase === 'countdown' ? (
            <CountdownTimer seconds={countdown} label="kalan" />
          ) : (
            <>
              <WaveformAnimation level={meterLevel} active={phase === 'recording'} />
              <Text style={styles.recordState}>
                {phase === 'recording' ? 'Kayit acik — dogal bir sekilde konus' : 'Kayit kapatiliyor'}
              </Text>
              <Text style={styles.seconds}>{secondsLeft}s</Text>
            </>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/sesli')}>
            <Ionicons name="close-outline" size={18} color={colors.text} />
            <Text style={styles.secondaryText}>Iptal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, phase !== 'recording' && styles.primaryBtnDisabled]}
            onPress={() => stopRecording()}
            disabled={phase !== 'recording'}
          >
            <Ionicons name="stop-circle" size={18} color={colors.bg} />
            <Text style={styles.primaryText}>Bitir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  eyebrow: { color: '#2563EB', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center', marginBottom: 10 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12, marginBottom: 24 },
  visualCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  recordState: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  seconds: { color: '#93C5FD', fontSize: 30, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  primaryBtn: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: '900' },
})
