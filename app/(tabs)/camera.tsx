import { useCallback, useMemo, useRef, useState } from 'react'
import { PremiumGate } from '../../components/PremiumGate'
import { usePremium } from '../../contexts/SubscriptionContext'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { Ionicons } from '@expo/vector-icons'
import { WordTipSheet } from '../../components/WordTipSheet'
import { SelectableReaderText } from '../../components/reader/SelectableReaderText'
import { SelectionToolbar } from '../../components/reader/SelectionToolbar'
import { BatchTranslationSheet } from '../../components/reader/BatchTranslationSheet'
import { SentenceTranslationSheet } from '../../components/reader/SentenceTranslationSheet'
import { useReaderSelection } from '../../hooks/useReaderSelection'
import { useSentenceTranslate } from '../../hooks/useSentenceTranslate'
import { getSentenceSpan } from '../../lib/sentence'
import { processOcr } from '../../lib/api'
import { useWordTip } from '../../hooks/useWordTip'
import { colors } from '../../lib/theme'
import { TextToken, tokenizeText } from '../../lib/tokenize'

type ScreenMode = 'camera' | 'result'

export default function CameraScreen() {
  const { isPro, isLoading: subLoading } = usePremium()
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<ScreenMode>('camera')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [tokens, setTokens] = useState<TextToken[]>([])
  const [rawText, setRawText] = useState('')
  const cameraRef = useRef<CameraView>(null)
  const { tip, isSaved, openWordTip, saveTip, closeTip } = useWordTip()

  const getSentence = useCallback(
    (index: number) =>
      tokens.slice(Math.max(0, index - 5), index + 6).map((t) => t.val).join(''),
    [tokens],
  )
  const selection = useReaderSelection(tokens, getSentence)
  const sentenceTr = useSentenceTranslate(tokens)

  function normalizeBase64(base64: string) {
    if (base64.startsWith('data:image/')) return base64
    return `data:image/jpeg;base64,${base64}`
  }

  async function prepareImageForOcr(input: { uri?: string; base64?: string | null }) {
    if (input.uri) {
      const manipulated = await ImageManipulator.manipulateAsync(
        input.uri,
        [{ resize: { width: 1600 } }],
        {
          compress: 0.55,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      )

      if (manipulated.base64) {
        return normalizeBase64(manipulated.base64)
      }
    }

    if (input.base64) {
      return normalizeBase64(input.base64)
    }

    throw new Error('OCR image payload missing')
  }

  async function processImage(input: { uri?: string; base64?: string | null }) {
    setProcessing(true)
    setError('')
    try {
      const normalized = await prepareImageForOcr(input)
      const data = await processOcr(normalized)
      const text = data.text?.trim() || ''

      if (text) {
        setRawText(text)
        setTokens(tokenizeText(text))
        setMode('result')
      } else {
        setError('Metin okunamadı. Daha net bir açıyla tekrar deneyin.')
      }
    } catch (e: any) {
      console.error(e)
      const message = String(e?.message || '')
      if (message.includes('timed out')) {
        setError('Tarama uzun sürdü. Daha kısa bir metin ya da daha net bir fotoğrafla tekrar deneyin.')
      } else {
        setError('Tarama başarısız oldu. Yakın çekim, iyi ışık ve tek paragraf ile tekrar deneyin.')
      }
    } finally {
      setProcessing(false)
    }
  }

  async function takePicture() {
    if (!cameraRef.current) return
    setProcessing(true)
    setError('')

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.55,
        skipProcessing: false,
      })
      if (photo?.uri) {
        await processImage({ uri: photo.uri, base64: photo.base64 })
      } else {
        setError('Fotoğraf alınamadı. Lütfen tekrar deneyin.')
      }
    } catch (e) {
      console.error(e)
      setProcessing(false)
      setError('Kamera görüntüsü alınamadı. Lütfen tekrar deneyin.')
    }
  }

  async function pickImage() {
    setError('')
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: false,
      quality: 0.55,
    })

    const asset = result.canceled ? null : result.assets[0]
    if (asset?.uri) {
      await processImage({ uri: asset.uri, base64: asset.base64 })
    } else if (asset?.base64) {
      await processImage({ base64: asset.base64 })
    }
  }

  const scanStats = useMemo(() => {
    const words = tokens.filter((token) => token.word).length
    const characters = rawText.replace(/\s/g, '').length
    const estimate = Math.max(1, Math.ceil(words / 140))

    return {
      words,
      characters,
      estimate,
    }
  }, [rawText, tokens])

  if (subLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (!isPro) {
    return (
      <PremiumGate
        feature="camera"
        title="Kamera ile kelime yakala"
        description="Kitap, dergi veya ekrandaki İngilizce metni tarayıp kelimelere dokunarak öğren."
      />
    )
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <View style={styles.permissionHero}>
          <Text style={styles.permissionEyebrow}>CAMERA OCR</Text>
          <Text style={styles.permissionTitle}>Basılı metni anında öğrenme yüzeyine çevir.</Text>
          <Text style={styles.permissionSubtitle}>
            Kamera izni ver, bir paragrafı tarat, sonra kelimelere dokunup anlam, telaffuz ve CEFR bilgisiyle çalış.
          </Text>
        </View>

        <View style={styles.permissionFeatureCard}>
          {[
            { icon: 'scan-outline', text: 'Metni tarayıp okunabilir bloklara dönüştürür' },
            { icon: 'hand-left-outline', text: 'Her kelime dokunulabilir hale gelir' },
            { icon: 'bookmark-outline', text: 'İlginç kelimeleri anında çalışma akışına eklersin' },
          ].map((item) => (
            <View key={item.icon} style={styles.permissionFeatureRow}>
              <Ionicons name={item.icon as any} size={18} color={colors.accent} />
              <Text style={styles.permissionFeatureText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.86}>
          <Ionicons name="camera-outline" size={18} color={colors.bg} />
          <Text style={styles.permissionBtnText}>Kamera İznini Aç</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (mode === 'result') {
    return (
      <SafeAreaView style={styles.resultScreen}>
        <View style={styles.resultHeader}>
          <TouchableOpacity
            onPress={() => {
              setMode('camera')
              setTokens([])
              setRawText('')
              setError('')
            }}
            style={styles.backBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
            <Text style={styles.backBtnText}>Yeniden Tara</Text>
          </TouchableOpacity>

          <View style={styles.headerCopy}>
            <Text style={styles.resultEyebrow}>OCR RESULT</Text>
            <Text style={styles.resultTitle}>Dokunulabilir okuma görünümü hazır.</Text>
          </View>
        </View>

        <View style={styles.resultStatsRow}>
          <View style={styles.resultStatCard}>
            <Text style={styles.resultStatLabel}>kelime</Text>
            <Text style={styles.resultStatValue}>{scanStats.words}</Text>
          </View>
          <View style={styles.resultStatCard}>
            <Text style={styles.resultStatLabel}>karakter</Text>
            <Text style={styles.resultStatValue}>{scanStats.characters}</Text>
          </View>
          <View style={styles.resultStatCard}>
            <Text style={styles.resultStatLabel}>okuma</Text>
            <Text style={styles.resultStatValue}>~{scanStats.estimate} dk</Text>
          </View>
        </View>

        <View style={styles.resultHintCard}>
          <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
          <Text style={styles.resultHintText}>
            Dokun → kelime anlamı · basılı tut → cümle çevirisi.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.textArea}>
          <SelectableReaderText
            tokens={tokens}
            selectionMode={selection.selectionMode}
            isSelected={selection.isSelected}
            isInSentence={sentenceTr.isInHighlightedSentence}
            activeWord={tip?.word}
            onWordPress={(i) =>
              selection.handleWordPress(i, () => {
                sentenceTr.close()
                const span = getSentenceSpan(tokens, i)
                openWordTip(tokens[i].val, span?.text ?? getSentence(i))
              })
            }
            onWordLongPress={(i) => {
              closeTip()
              selection.exitSelection()
              void sentenceTr.translateAt(i)
            }}
          />
        </ScrollView>

        <SelectionToolbar
          visible={selection.selectionMode}
          count={selection.count}
          translating={selection.translating}
          onClear={selection.clearSelection}
          onTranslate={selection.translateSelected}
          onClose={selection.exitSelection}
        />

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

        <WordTipSheet tip={tip} saved={isSaved} onClose={closeTip} onSave={() => saveTip()} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SCAN & LEARN</Text>
        <Text style={styles.title}>Kamera ile metni öğrenme akışına sok.</Text>
        <Text style={styles.subtitle}>
          Basılı bir sayfayı, ekran görüntüsünü ya da kısa bir paragrafı tara; sonra kelimeleri tek tek açıp çalışma listenize ekle.
        </Text>
      </View>

      <View style={styles.valueRow}>
        {[
          { label: 'OCR', value: 'Anında' },
          { label: 'TIP', value: 'Dokunulabilir' },
          { label: 'SAVE', value: '1 dokunuş' },
        ].map((item) => (
          <View key={item.label} style={styles.valueCard}>
            <Text style={styles.valueLabel}>{item.label}</Text>
            <Text style={styles.valueValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cameraShell}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={styles.scanGuideTop} />
              <View style={styles.scanGuideBottom} />
            </View>
            <View style={styles.overlayFooter}>
              <Text style={styles.scanHint}>Metni çerçeve içine al ve mümkünse tek paragraf odakla.</Text>
              <Text style={styles.scanSubhint}>En iyi sonuç için iyi ışık ve düz açı kullan.</Text>
            </View>
          </View>
        </CameraView>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={16} color="#fda4af" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickImage} activeOpacity={0.85}>
          <Ionicons name="images-outline" size={18} color={colors.text} />
          <Text style={styles.galleryText}>Galeriden Seç</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureBtn, processing && styles.captureBtnDisabled]}
          onPress={takePicture}
          activeOpacity={0.9}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <Ionicons name="scan-outline" size={18} color={colors.bg} />
              <Text style={styles.captureText}>Metni Tara</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.captureFootnote}>
        En stabil sonuç için tek paragraf, yakın kadraj ve mümkünse düz beyaz arka plan kullan.
      </Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },

  permissionScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: 'center',
  },
  permissionHero: {
    marginBottom: 22,
  },
  permissionEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 10,
  },
  permissionSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  permissionFeatureCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    gap: 14,
    marginBottom: 20,
  },
  permissionFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  permissionFeatureText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  permissionBtnText: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 15,
  },

  hero: {
    marginBottom: 18,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  valueRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  valueCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  valueLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  valueValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  cameraShell: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#050505',
    marginBottom: 14,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scanFrame: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1.35,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(250,204,21,0.65)',
    backgroundColor: 'rgba(250,204,21,0.06)',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  scanGuideTop: {
    alignSelf: 'center',
    width: '72%',
    borderTopWidth: 2,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  scanGuideBottom: {
    alignSelf: 'center',
    width: '72%',
    borderBottomWidth: 2,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  overlayFooter: {
    position: 'absolute',
    bottom: 26,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.56)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  scanHint: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  scanSubhint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 18,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(127,29,29,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.26)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: '#fda4af',
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  galleryBtn: {
    flex: 1,
    minHeight: 54,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  galleryText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  captureBtn: {
    flex: 1.2,
    minHeight: 54,
    backgroundColor: colors.accent,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  captureBtnDisabled: {
    opacity: 0.75,
  },
  captureText: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 14,
  },
  captureFootnote: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 10,
  },

  resultScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 12,
  },
  resultHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerCopy: {
    gap: 4,
  },
  resultEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  backBtn: {
    alignSelf: 'flex-start',
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
  backBtnText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  resultStatsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  resultStatCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  resultStatLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultStatValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  resultHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(250,204,21,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.18)',
    borderRadius: 14,
    padding: 12,
  },
  resultHintText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  textArea: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  readText: {
    fontSize: 18,
    lineHeight: 31,
    color: colors.text,
  },
  word: {
    color: colors.text,
  },
  punct: {
    color: colors.text,
  },
})
