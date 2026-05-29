import {
  Modal, Pressable, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, Share,
} from 'react-native'
import Animated, { SlideInDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { speak } from '../../lib/speech'

interface SentenceTranslationSheetProps {
  visible: boolean
  original: string | null
  translation: string | null
  loading?: boolean
  error?: string | null
  onClose: () => void
  onRetry?: () => void
}

export function SentenceTranslationSheet({
  visible,
  original,
  translation,
  loading,
  error,
  onClose,
  onRetry,
}: SentenceTranslationSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Animated.View entering={SlideInDown.duration(280).springify()}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.eyebrow}>CÜMLE ÇEVİRİSİ</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {original ? (
              <View style={styles.originalCard}>
                <View style={styles.originalHeader}>
                  <Text style={styles.label}>İNGİLİZCE</Text>
                  <TouchableOpacity onPress={() => speak(original)} hitSlop={10}>
                    <Ionicons name="volume-medium-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.original}>{original}</Text>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.accent} size="large" />
                <Text style={styles.loadingText}>Cümle çevriliyor…</Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#fda4af" />
                <Text style={styles.errorText}>{error}</Text>
                {onRetry ? (
                  <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                    <Ionicons name="refresh-outline" size={16} color={colors.accent} />
                    <Text style={styles.retryText}>Tekrar dene</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : translation ? (
              <View style={styles.trCard}>
                <View style={styles.trHeader}>
                  <Text style={styles.label}>TÜRKÇE</Text>
                  <TouchableOpacity
                    hitSlop={10}
                    onPress={() => {
                      void Share.share({
                        message: original ? `${original}\n\n→ ${translation}` : translation,
                      })
                    }}
                  >
                    <Ionicons name="share-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.translation}>{translation}</Text>
              </View>
            ) : null}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '78%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  eyebrow: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  label: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  originalCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  originalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  original: { color: colors.text, fontSize: 16, lineHeight: 26, fontWeight: '500' },
  trCard: {
    backgroundColor: colors.accentDim,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.28)',
  },
  trHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  translation: { color: colors.text, fontSize: 20, lineHeight: 30, fontWeight: '700' },
  loadingBox: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  errorBox: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  errorText: { color: '#fda4af', fontSize: 13, lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    backgroundColor: colors.accentDim,
  },
  retryText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
})
