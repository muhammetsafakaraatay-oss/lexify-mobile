import { useMemo, useState } from 'react'
import {
  ActivityIndicator, Alert, Linking, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { fetchArticle, fetchYoutubeTranscript } from '../../lib/api'

type AudioMode = 'song' | 'podcast'
type LinkKind =
  | 'youtube'      // youtube.com, youtu.be
  | 'spotify'      // open.spotify.com (track / episode)
  | 'genius'       // genius.com (lyrics)
  | 'apple_music'  // music.apple.com
  | 'apple_podcasts' // podcasts.apple.com
  | 'rss'          // .rss / .xml feeds
  | 'web'          // anything else http(s)
  | 'invalid'      // not a URL

type LinkInfo = {
  kind: LinkKind
  label: string          // human label for the chip
  canAutoFetch: boolean  // can we pull lyrics/transcript automatically?
  hint: string           // small explainer under the URL field
}

// ──────────────────────────────────────────────────────────────────────────
// Link detection — purely pattern-based, no network call.
// ──────────────────────────────────────────────────────────────────────────
function detectLink(raw: string): LinkInfo {
  const value = raw.trim()
  if (!value) {
    return { kind: 'invalid', label: '', canAutoFetch: false, hint: '' }
  }
  let parsed: URL | null = null
  try {
    parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return {
      kind: 'invalid',
      label: 'Geçersiz link',
      canAutoFetch: false,
      hint: 'Geçerli bir URL gir (örn. https://...).',
    }
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  if (host.includes('youtube.com') || host === 'youtu.be') {
    return {
      kind: 'youtube',
      label: 'YouTube algılandı',
      canAutoFetch: true,
      hint: 'YouTube transcript’i otomatik getirilebilir.',
    }
  }
  if (host.includes('genius.com')) {
    return {
      kind: 'genius',
      label: 'Genius lyrics algılandı',
      canAutoFetch: true,
      hint: 'Genius sayfasından sözleri otomatik getirebiliriz.',
    }
  }
  if (host.includes('open.spotify.com') || host.endsWith('spotify.com')) {
    return {
      kind: 'spotify',
      label: 'Spotify algılandı',
      canAutoFetch: false,
      hint: 'Spotify telifli içerikten dolayı transcript veremiyor — sözleri/transcript’i elinle yapıştır.',
    }
  }
  if (host.includes('music.apple.com')) {
    return {
      kind: 'apple_music',
      label: 'Apple Music algılandı',
      canAutoFetch: false,
      hint: 'Apple Music sözleri otomatik alamıyor — elinle yapıştır.',
    }
  }
  if (host.includes('podcasts.apple.com')) {
    return {
      kind: 'apple_podcasts',
      label: 'Apple Podcasts algılandı',
      canAutoFetch: false,
      hint: 'Apple Podcasts transcript’i otomatik veremiyor — elinle yapıştır.',
    }
  }
  if (parsed.pathname.endsWith('.rss') || parsed.pathname.endsWith('.xml')) {
    return {
      kind: 'rss',
      label: 'RSS akışı algılandı',
      canAutoFetch: true,
      hint: 'RSS açıklamasından metin getirebiliriz (transcript varsa).',
    }
  }
  return {
    kind: 'web',
    label: host,
    canAutoFetch: true,
    hint: 'Bu sayfanın okunabilir metnini almayı deneyebiliriz.',
  }
}

function iconForKind(kind: LinkKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'youtube': return 'logo-youtube'
    case 'spotify': return 'musical-notes'
    case 'genius': return 'document-text-outline'
    case 'apple_music': return 'musical-note'
    case 'apple_podcasts': return 'mic-outline'
    case 'rss': return 'radio-outline'
    case 'web': return 'globe-outline'
    case 'invalid': return 'alert-circle-outline'
  }
}

function colorForKind(kind: LinkKind): string {
  switch (kind) {
    case 'youtube': return '#ff4d4d'
    case 'spotify': return '#1DB954'
    case 'genius': return '#facc15'
    case 'apple_music': return '#fa57c1'
    case 'apple_podcasts': return '#a855f7'
    case 'rss': return '#fb923c'
    case 'web': return colors.accent
    case 'invalid': return '#f87171'
  }
}

// Naive helper: extract a sensible title from an article-style fetch result.
function pickTitle(candidate: string | null | undefined, fallback: string): string {
  const v = (candidate ?? '').trim()
  return v.length > 0 ? v : fallback
}

export default function AudioTextScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<AudioMode>('song')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchedFromUrl, setFetchedFromUrl] = useState(false)

  const link = useMemo(() => detectLink(url), [url])
  const canSubmit = (text.trim().length > 0) || (link.kind !== 'invalid' && link.kind !== 'web' ? true : link.kind === 'web' && url.trim().length > 0)
  const trimmedUrl = url.trim()

  async function handleAutoFetch() {
    if (!trimmedUrl || !link.canAutoFetch || fetching) return
    setFetching(true)
    try {
      if (link.kind === 'youtube') {
        const payload = await fetchYoutubeTranscript(trimmedUrl)
        const segs = Array.isArray((payload as any)?.segments) ? (payload as any).segments : []
        const fullText = segs
          .map((s: any) => String(s?.text ?? '').trim())
          .filter(Boolean)
          .join('\n')
        if (!fullText) {
          throw new Error('Bu YouTube videosu için transcript bulunamadı.')
        }
        setText(fullText)
        const ytTitle = pickTitle((payload as any)?.title, mode === 'song' ? 'YouTube Şarkı' : 'YouTube Podcast')
        if (!title.trim()) setTitle(ytTitle)
        setFetchedFromUrl(true)
      } else if (link.kind === 'genius' || link.kind === 'web' || link.kind === 'rss') {
        const article = await fetchArticle(trimmedUrl)
        const fullText = (article?.text ?? '').trim()
        if (!fullText) throw new Error('Bu sayfadan okunabilir metin alınamadı.')
        setText(fullText)
        // ArticlePayload only types `text?`, but backends commonly return a `title`. Read it safely.
        const maybeTitle = (article as { title?: string } | undefined)?.title
        if (!title.trim()) setTitle(pickTitle(maybeTitle, link.kind === 'genius' ? 'Genius' : link.label))
        setFetchedFromUrl(true)
      } else {
        Alert.alert('Otomatik alınamıyor', link.hint)
      }
    } catch (e: any) {
      Alert.alert('Otomatik metin alınamadı', e?.message ?? 'Bilinmeyen hata. Metni elinle yapıştırabilirsin.')
    } finally {
      setFetching(false)
    }
  }

  async function handleOpenExternal() {
    if (!trimmedUrl) return
    try {
      const supported = await Linking.canOpenURL(trimmedUrl)
      if (!supported) {
        Alert.alert('Açılamadı', 'Bu link bu cihazda açılamıyor.')
        return
      }
      await Linking.openURL(trimmedUrl)
    } catch (e: any) {
      Alert.alert('Açılamadı', e?.message ?? 'Bilinmeyen hata')
    }
  }

  function handleClear() {
    setText('')
    setFetchedFromUrl(false)
  }

  function handleSubmit() {
    const trimmedText = text.trim()
    const fallbackTitle = mode === 'song' ? 'Şarkı Modu' : 'Podcast Modu'
    const finalTitle = title.trim() || (fetchedFromUrl ? link.label : fallbackTitle)

    // Three valid combinations:
    // (1) Manual text exists → open reader with text; URL travels as metadata (not auto-fetched)
    // (2) Only URL exists & it's auto-fetchable → ask oku to fetch it
    // (3) Only URL exists & not auto-fetchable (Spotify/Apple) → can't do anything meaningful in reader, alert.
    if (trimmedText.length > 0) {
      router.push({
        pathname: '/(tabs)/oku',
        params: {
          // Title + text reader will tokenize.
          manualTitle: finalTitle,
          manualText: trimmedText,
          // Stored as metadata so the source is still accessible from the reader screen.
          sourceUrl: trimmedUrl || undefined,
          audioMode: mode,
        } as any,
      })
      return
    }

    if (!trimmedUrl) {
      Alert.alert('Boş', 'Bir link gir veya sözleri yapıştır.')
      return
    }

    if (link.kind === 'invalid') {
      Alert.alert('Geçersiz link', link.hint)
      return
    }

    if (link.canAutoFetch) {
      router.push({
        pathname: '/(tabs)/oku',
        params: {
          prefillUrl: trimmedUrl,
          manualTitle: finalTitle,
          audioMode: mode,
        } as any,
      })
      return
    }

    // Spotify / Apple Music / Apple Podcasts — no DRM-free text source we can hit.
    Alert.alert(
      'Otomatik metin yok',
      `${link.label} için telifli içerik nedeniyle metni otomatik alamıyoruz. Sözleri / transcript’i aşağıdaki kutuya yapıştır veya “Linki aç” ile kaynağa git.`,
    )
  }

  const accent = colorForKind(link.kind)
  const showChip = trimmedUrl.length > 0
  const fetchDisabled = !link.canAutoFetch || fetching || !trimmedUrl

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{mode === 'song' ? 'Şarkı Modu' : 'Podcast Modu'}</Text>
        <Text style={styles.subtitle}>
          Link yapıştır → algılayıp mümkünse sözleri/transcript’i otomatik getirelim. YouTube ve Genius için tek dokunuş yeter.
        </Text>

        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeChip, mode === 'song' && styles.modeChipActive]} onPress={() => setMode('song')}>
            <Ionicons name="musical-notes" size={14} color={mode === 'song' ? colors.bg : colors.textMuted} />
            <Text style={[styles.modeText, mode === 'song' && styles.modeTextActive]}>Şarkı</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeChip, mode === 'podcast' && styles.modeChipActive]} onPress={() => setMode('podcast')}>
            <Ionicons name="mic-outline" size={14} color={mode === 'podcast' ? colors.bg : colors.textMuted} />
            <Text style={[styles.modeText, mode === 'podcast' && styles.modeTextActive]}>Podcast</Text>
          </TouchableOpacity>
        </View>

        {/* URL block */}
        <Text style={styles.label}>LİNK</Text>
        <View style={[styles.urlRow, showChip && { borderColor: accent + '55' }]}>
          <Ionicons
            name={showChip ? iconForKind(link.kind) : 'link-outline'}
            size={18}
            color={showChip ? accent : colors.textMuted}
          />
          <TextInput
            style={styles.urlInput}
            placeholder={mode === 'song' ? 'YouTube / Spotify / Genius linki' : 'YouTube / Spotify / RSS linki'}
            placeholderTextColor={colors.textMuted}
            value={url}
            onChangeText={(v) => { setUrl(v); setFetchedFromUrl(false) }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.OS === 'ios' ? 'url' : 'default'}
          />
          {url.length > 0 ? (
            <TouchableOpacity onPress={() => { setUrl(''); setFetchedFromUrl(false) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {showChip ? (
          <View style={styles.chipRow}>
            <View style={[styles.chip, { borderColor: accent, backgroundColor: accent + '20' }]}>
              <Ionicons name={iconForKind(link.kind)} size={12} color={accent} />
              <Text style={[styles.chipText, { color: accent }]}>{link.label}</Text>
            </View>
            <TouchableOpacity onPress={handleOpenExternal} style={styles.openBtn} activeOpacity={0.85}>
              <Ionicons name="open-outline" size={14} color={colors.text} />
              <Text style={styles.openBtnText}>Linki aç</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showChip && link.hint ? (
          <Text style={styles.hint}>{link.hint}</Text>
        ) : null}

        {/* Auto-fetch button */}
        <TouchableOpacity
          onPress={handleAutoFetch}
          style={[styles.fetchBtn, fetchDisabled && styles.fetchBtnDisabled]}
          disabled={fetchDisabled}
          activeOpacity={0.85}
        >
          {fetching ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <>
              <Ionicons name="download-outline" size={15} color={fetchDisabled ? colors.textMuted : colors.bg} />
              <Text style={[styles.fetchBtnText, fetchDisabled && { color: colors.textMuted }]}>
                {link.kind === 'youtube' ? 'YouTube transcript’ini getir'
                  : link.kind === 'genius' ? 'Genius sözlerini getir'
                  : link.kind === 'rss' ? 'RSS metnini getir'
                  : link.kind === 'web' ? 'Sayfa metnini getir'
                  : 'Linkten metin getir'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.label}>BAŞLIK</Text>
        <TextInput
          style={styles.input}
          placeholder={mode === 'song' ? 'Şarkı adı (opsiyonel)' : 'Bölüm adı (opsiyonel)'}
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />

        {/* Text area */}
        <View style={styles.textHeaderRow}>
          <Text style={styles.label}>{mode === 'song' ? 'SÖZLER' : 'TRANSCRIPT'}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {fetchedFromUrl ? (
              <View style={styles.autoBadge}>
                <Ionicons name="checkmark-circle" size={11} color="#4ade80" />
                <Text style={styles.autoBadgeText}>linkten geldi</Text>
              </View>
            ) : null}
            {text.length > 0 ? (
              <TouchableOpacity onPress={handleClear}>
                <Text style={styles.linkBtn}>Temizle</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <TextInput
          style={styles.textArea}
          multiline
          textAlignVertical="top"
          placeholder={mode === 'song' ? 'Sözleri buraya yapıştır...' : 'Transcript’i buraya yapıştır...'}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={(v) => { setText(v); if (!v) setFetchedFromUrl(false) }}
        />
        {text.length > 0 ? (
          <Text style={styles.charCount}>{text.trim().split(/\s+/).filter(Boolean).length} kelime</Text>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
          disabled={!canSubmit}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          <Ionicons name="book-outline" size={16} color={canSubmit ? colors.bg : colors.textMuted} />
          <Text style={[styles.primaryText, !canSubmit && { color: colors.textMuted }]}>
            {text.trim().length > 0 ? 'Reader’da Aç' : link.canAutoFetch ? 'Linki aç ve oku' : 'Reader’da Aç'}
          </Text>
        </TouchableOpacity>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Nasıl çalışır?</Text>
          <Text style={styles.tipText}>
            • YouTube linkleri için transcript’i otomatik çekeriz.{'\n'}
            • Genius linklerinden şarkı sözlerini alabiliriz.{'\n'}
            • Spotify / Apple Music telifli içeriği otomatik veremiyor — sözleri sen yapıştırırsın, linki kaynak olarak saklarız.{'\n'}
            • Reader’da açıldığında her kelimeye dokunup kaydedebilir, çevirisini görebilirsin.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 12, paddingBottom: 48 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 18 },

  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 11,
  },
  modeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeText: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  modeTextActive: { color: colors.bg },

  label: {
    color: colors.textMuted, fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 4,
  },

  urlRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
  },
  urlInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: Platform.OS === 'ios' ? 0 : 8 },

  chipRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  openBtnText: { color: colors.text, fontWeight: '800', fontSize: 11, letterSpacing: 0.3 },

  hint: {
    color: colors.textDim, fontSize: 12, lineHeight: 17,
    marginTop: 6, marginBottom: 4,
  },

  fetchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 10, marginBottom: 16,
    backgroundColor: colors.accent, paddingVertical: 12, borderRadius: 12,
  },
  fetchBtnDisabled: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  fetchBtnText: { color: colors.bg, fontWeight: '900', fontSize: 13 },

  input: {
    backgroundColor: colors.bgSurface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, color: colors.text, fontSize: 14, marginBottom: 12,
  },

  textHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 4,
  },
  autoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: '#0f1d14', borderWidth: 1, borderColor: '#4ade80',
  },
  autoBadgeText: { color: '#4ade80', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  linkBtn: { color: colors.accent, fontWeight: '800', fontSize: 12 },

  textArea: {
    minHeight: 220, backgroundColor: colors.bgSurface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 14, color: colors.text,
    fontSize: 14, marginTop: 6,
  },
  charCount: {
    color: colors.textDim, fontSize: 11, marginTop: 4, textAlign: 'right',
  },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 16, backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 14,
  },
  primaryBtnDisabled: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: '900' },

  tipCard: {
    backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 16, marginTop: 18,
  },
  tipTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 6 },
  tipText: { color: colors.textMuted, fontSize: 12, lineHeight: 19 },
})
