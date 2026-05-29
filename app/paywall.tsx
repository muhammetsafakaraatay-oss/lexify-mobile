import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { colors } from '../lib/theme'
import { PRO_FEATURES } from '../lib/plan'
import { LEGAL_URLS } from '../lib/legal'
import { useSubscription } from '../contexts/SubscriptionContext'
import type { PlanPeriod } from '../lib/subscription'

export default function PaywallScreen() {
  const router = useRouter()
  const { isPro, packages, purchase, restore, isLoading } = useSubscription()
  const [selected, setSelected] = useState<PlanPeriod>('yearly')
  const [busy, setBusy] = useState(false)

  const selectedPkg = packages.find((p) => p.id === selected) ?? packages[0]

  async function handlePurchase() {
    if (!selectedPkg) return
    setBusy(true)
    const result = await purchase(selectedPkg)
    setBusy(false)
    if (result.ok) {
      Alert.alert('Hoş geldin!', 'Lexify Pro aktif. Tüm özelliklerin kilidi açıldı.', [
        { text: 'Harika', onPress: () => router.back() },
      ])
      return
    }
    if (result.error) Alert.alert('Satın alma', result.error)
  }

  async function handleRestore() {
    setBusy(true)
    const result = await restore()
    setBusy(false)
    if (result.ok) {
      Alert.alert('Geri yüklendi', 'Pro aboneliğin aktif.', [{ text: 'Tamam', onPress: () => router.back() }])
    } else if (result.error) {
      Alert.alert('Geri yükleme', result.error)
    }
  }

  if (isPro) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.proActive}>
          <Ionicons name="checkmark-circle" size={64} color="#4ade80" />
          <Text style={styles.proTitle}>Pro aktif</Text>
          <Text style={styles.proSub}>Tüm premium özelliklere erişimin var.</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.closeIcon} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <View style={styles.heroIcon}>
            <Ionicons name="diamond" size={36} color={colors.accent} />
          </View>
          <Text style={styles.eyebrow}>LEXIFY PRO</Text>
          <Text style={styles.title}>Gerçek öğrenme{'\n'}döngüsünü aç</Text>
          <Text style={styles.subtitle}>
            Anki + sözlük + YouTube transcript yerine tek uygulama. Gerçek içerikten öğren, unutmadan tekrar et.
          </Text>
          <View style={styles.compareCard}>
            <Text style={styles.compareTitle}>Ücretsiz vs Pro</Text>
            {[
              { f: 'Metin okuma & çeviri', free: true, pro: true },
              { f: 'Flashcard (SM-2)', free: '12/gün', pro: 'Sınırsız' },
              { f: 'Kamera OCR', free: false, pro: true },
              { f: 'YouTube transcript', free: false, pro: true },
              { f: 'Kelime kaydı', free: '30 kelime', pro: 'Sınırsız' },
            ].map((row) => (
              <View key={row.f} style={styles.compareRow}>
                <Text style={styles.compareFeature}>{row.f}</Text>
                <Text style={styles.compareFree}>{row.free === true ? '✓' : row.free === false ? '—' : row.free}</Text>
                <Text style={styles.comparePro}>{row.pro === true ? '✓' : row.pro}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120).duration(400).springify()} style={styles.features}>
          {PRO_FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400).springify()} style={styles.plans}>
          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
          ) : (
            packages.map((pkg) => {
              const active = selected === pkg.id
              return (
                <TouchableOpacity
                  key={pkg.id}
                  style={[styles.planCard, active && styles.planCardActive]}
                  onPress={() => setSelected(pkg.id)}
                  activeOpacity={0.9}
                >
                  {pkg.badge ? (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{pkg.badge}</Text>
                    </View>
                  ) : null}
                  <View style={styles.planRow}>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>{pkg.title}</Text>
                      <Text style={styles.planPrice}>
                        {pkg.priceString}
                        <Text style={styles.planPeriod}>{pkg.periodLabel}</Text>
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </Animated.View>

        <TouchableOpacity
          style={[styles.cta, busy && { opacity: 0.7 }]}
          onPress={handlePurchase}
          disabled={busy || !selectedPkg}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <Text style={styles.ctaText}>
                {selected === 'yearly' ? '7 Gün Ücretsiz Dene' : 'Pro\'ya Başla'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={colors.bg} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={busy}>
          <Text style={styles.restoreText}>Satın alımları geri yükle</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Abonelik otomatik yenilenir. İptal için App Store → Abonelikler.{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
          >
            Gizlilik Politikası
          </Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24, paddingBottom: 40 },
  closeIcon: { alignSelf: 'flex-end', marginBottom: 8 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + '35',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, lineHeight: 38, marginBottom: 10 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 16, maxWidth: 340 },
  compareCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    width: '100%',
  },
  compareTitle: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  compareFeature: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '600' },
  compareFree: { width: 52, textAlign: 'center', color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  comparePro: { width: 52, textAlign: 'center', color: colors.accent, fontSize: 11, fontWeight: '800' },
  features: { gap: 12, marginBottom: 24 },
  featureRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  featureDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  plans: { gap: 10, marginBottom: 20 },
  planCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  planCardActive: { borderColor: colors.accent, backgroundColor: colors.accent + '10' },
  planBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  planBadgeText: { color: colors.bg, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  planTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  planPrice: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  planPeriod: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 17,
    marginBottom: 12,
  },
  ctaText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  restoreBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 16 },
  restoreText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  legal: { color: colors.textDim, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  legalLink: { color: colors.accent, textDecorationLine: 'underline' },
  proActive: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  proTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  proSub: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  closeBtn: { marginTop: 20, backgroundColor: colors.bgCard, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, borderWidth: 1, borderColor: colors.border },
  closeBtnText: { color: colors.text, fontWeight: '700' },
})
