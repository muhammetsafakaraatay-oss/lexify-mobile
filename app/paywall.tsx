import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { colors } from '../lib/theme'
import { useSubscription } from '../lib/revenuecat'

const FEATURES = [
  { icon: 'mic-outline', title: 'Sesli pratik arsivi', desc: 'Kendi sesinle pratik yap, transcript ve koçluk notlarini sakla' },
  { icon: 'infinite-outline', title: 'Sınırsız kelime kaydı', desc: 'Okurken, videoda ve OCR ile istediğin kadar kelime' },
  { icon: 'camera-outline', title: 'Kamera OCR', desc: 'Kitap ve ekranlardan metin tara, kelimeye dokun' },
  { icon: 'play-circle-outline', title: 'YouTube transcript', desc: 'Video izlerken transcript üzerinden öğren' },
  { icon: 'layers-outline', title: 'Sınırsız çalışma', desc: 'Sınırsız flashcard, quiz ve SRS tekrarı' },
]

export default function PaywallScreen() {
  const router = useRouter()
  const { offerings, isSubscribed, isLoading, isPurchasing, isRestoring, purchase, restore } = useSubscription()
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [successVisible, setSuccessVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentOffering = offerings?.current
  const pkg = currentOffering?.availablePackages?.[0]
  const priceString = pkg?.product?.priceString ?? '...'
  const title = pkg?.product?.title ?? 'Lexify Premium'

  if (isSubscribed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
          <Text style={styles.successTitle}>Zaten Premium!</Text>
          <Text style={styles.successSub}>Tüm özelliklere erişimin var.</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeBtnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  async function handlePurchase() {
    if (!pkg) return
    setConfirmVisible(false)
    setError(null)
    try {
      await purchase(pkg)
      setSuccessVisible(true)
    } catch (e: any) {
      if (e?.userCancelled) return
      setError(e?.message ?? 'Satın alma başarısız.')
    }
  }

  async function handleRestore() {
    setError(null)
    try {
      await restore()
      setSuccessVisible(true)
    } catch (e: any) {
      setError(e?.message ?? 'Geri yükleme başarısız.')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeIcon} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✦ PREMIUM</Text>
          </View>
          <Text style={styles.headerTitle}>Lexify'ı tam güçte kullan</Text>
          <Text style={styles.headerSub}>Dil öğrenmenizi hızlandıran tüm özellikler</Text>
        </View>

        {/* Word limit bar */}
        <View style={styles.limitCard}>
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>Kelime kaydı</Text>
            <View style={styles.limitPills}>
              <View style={styles.pillFree}><Text style={styles.pillText}>30 kelime</Text></View>
              <View style={styles.pillPremium}><Text style={styles.pillPremiumText}>Sınırsız</Text></View>
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View key={f.title} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureBorder]}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
              <Ionicons name="checkmark" size={16} color={colors.accent} />
            </View>
          ))}
        </View>

        {/* Pricing */}
        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
        ) : (
          <TouchableOpacity style={styles.pricingCard} onPress={() => setConfirmVisible(true)} activeOpacity={0.85}>
            <View style={styles.pricingRadio}>
              <View style={styles.pricingRadioInner} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pricingTitle}>Aylık</Text>
            </View>
            <Text style={styles.pricingAmount}>{priceString}<Text style={styles.pricingPer}>/ay</Text></Text>
          </TouchableOpacity>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (isPurchasing || isLoading || !pkg) && styles.ctaBtnDisabled]}
          onPress={() => setConfirmVisible(true)}
          disabled={isPurchasing || isLoading || !pkg}
          activeOpacity={0.85}
        >
          {isPurchasing
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.ctaBtnText}>7 Gün Ücretsiz Dene →</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={isRestoring}>
          {isRestoring
            ? <ActivityIndicator color={colors.textMuted} size="small" />
            : <Text style={styles.restoreText}>Satın almaları geri yükle</Text>
          }
        </TouchableOpacity>

        <Text style={styles.legalText}>
          Abonelik otomatik yenilenir. İptal için App Store → Abonelikler.
        </Text>
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Satın almayı onayla</Text>
            <Text style={styles.modalBody}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{title}</Text>
              {' '}— {priceString}/ay{'\n'}7 gün ücretsiz deneme ile başlar.
            </Text>
            <TouchableOpacity style={styles.modalConfirm} onPress={handlePurchase}>
              <Text style={styles.modalConfirmText}>Onayla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setConfirmVisible(false)}>
              <Text style={styles.modalCancelText}>İptal</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Success Modal */}
      <Modal visible={successVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => { setSuccessVisible(false); router.back() }}>
          <View style={styles.modalCard}>
            <Ionicons name="checkmark-circle" size={48} color={colors.accent} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Premium aktif! 🎉</Text>
            <Text style={styles.modalBody}>Tüm özelliklere erişimin açıldı.</Text>
            <TouchableOpacity style={styles.modalConfirm} onPress={() => { setSuccessVisible(false); router.back() }}>
              <Text style={styles.modalConfirmText}>Harika!</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  content: { padding: 20, paddingBottom: 48 },

  header: { alignItems: 'center', paddingVertical: 20, position: 'relative' },
  closeIcon: { position: 'absolute', top: 0, right: 0, padding: 8 },
  badge: { backgroundColor: colors.accentDim, borderWidth: 1, borderColor: 'rgba(250,204,21,0.3)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 14 },
  badgeText: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 8 },
  headerSub: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  limitCard: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  limitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  limitLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  limitPills: { flexDirection: 'row', gap: 8 },
  pillFree: { backgroundColor: '#1a1a1a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, color: colors.textMuted },
  pillPremium: { backgroundColor: colors.accentDim, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(250,204,21,0.3)' },
  pillPremiumText: { fontSize: 12, color: colors.accent, fontWeight: '700' },

  featuresCard: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  featureBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  featureIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  featureDesc: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },

  pricingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: colors.accent, gap: 12 },
  pricingRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  pricingRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  pricingTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  pricingAmount: { fontSize: 20, fontWeight: '900', color: colors.accent },
  pricingPer: { fontSize: 13, fontWeight: '400', color: colors.textMuted },

  errorText: { color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 },

  ctaBtn: { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 14 },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: colors.bg, fontSize: 17, fontWeight: '900' },

  restoreBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 8 },
  restoreText: { color: colors.textMuted, fontSize: 13 },

  legalText: { color: '#444', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  successTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  successSub: { fontSize: 14, color: colors.textMuted },
  closeBtn: { marginTop: 16, backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  closeBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#141414', borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 12 },
  modalBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalConfirm: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  modalConfirmText: { color: colors.bg, fontWeight: '900', fontSize: 16 },
  modalCancel: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { color: colors.textMuted, fontSize: 14 },
})
