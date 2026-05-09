import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  Dimensions, Animated, Easing, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from '../lib/theme'
import { cefrColors } from '../lib/cefr'
import { Ionicons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')

// ────────────────────────────────────────────────────────────────────────────
// Step definitions
// ────────────────────────────────────────────────────────────────────────────

type StepKind = 'welcome' | 'feature' | 'level' | 'goal' | 'finish'

interface FeatureStep {
  kind: 'feature'
  icon: keyof typeof Ionicons.glyphMap
  accent: string
  eyebrow: string
  title: string
  desc: string
  highlight: { label: string; value: string }
}

interface SimpleStep {
  kind: Exclude<StepKind, 'feature'>
}

type Step = FeatureStep | SimpleStep

const STEPS: Step[] = [
  { kind: 'welcome' },
  {
    kind: 'feature',
    icon: 'book-outline',
    accent: '#facc15',
    eyebrow: 'AKILLI OKUMA',
    title: 'Okurken öğren,\nakıştan çıkma',
    desc: 'BBC, NYT, YouTube — herhangi bir İngilizce kaynağı aç. Bilmediğin kelimeye dokun, anlamı anında gelsin.',
    highlight: { label: 'Çeviri gecikmesi', value: '< 1 sn' },
  },
  {
    kind: 'feature',
    icon: 'layers-outline',
    accent: '#60a5fa',
    eyebrow: 'ARALIKLI TEKRAR',
    title: 'Bilim destekli\nezberleme',
    desc: 'Anki ile aynı SM-2 algoritması. Beynin unutmaya yaklaştığı anda kelime tekrar karşına çıkar.',
    highlight: { label: 'Hafızada kalıcılık', value: '%89' },
  },
  {
    kind: 'feature',
    icon: 'sparkles-outline',
    accent: '#e879f9',
    eyebrow: 'KİŞİSEL TAKİP',
    title: 'CEFR seviyene\ngöre yönlen',
    desc: 'Her kelime A1\'den C2\'ye etiketlenir. Hangi seviyede patladığını ve sıçraman gereken alanı net gör.',
    highlight: { label: 'CEFR seviye', value: 'A1 → C2' },
  },
  { kind: 'level' },
  { kind: 'goal' },
  { kind: 'finish' },
]

const CEFR_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'A1', label: 'Başlangıç', desc: 'Yeni başlıyorum' },
  { value: 'A2', label: 'Temel', desc: 'Bazı kelimeler tanıyorum' },
  { value: 'B1', label: 'Orta', desc: 'Basit metinleri anlarım' },
  { value: 'B2', label: 'Üst-Orta', desc: 'Çoğu makaleyi okurum' },
  { value: 'C1', label: 'İleri', desc: 'Akademik metinler tamam' },
  { value: 'C2', label: 'Uzman', desc: 'Anadil seviyesine yakın' },
]

const GOAL_OPTIONS: { value: number; label: string; sub: string; rec?: boolean }[] = [
  { value: 5,  label: '5 kelime',  sub: '~3 dk / gün · Rahat tempo' },
  { value: 10, label: '10 kelime', sub: '~5 dk / gün · Önerilen', rec: true },
  { value: 20, label: '20 kelime', sub: '~10 dk / gün · Hızlı ilerleme' },
  { value: 50, label: '50 kelime', sub: '~25 dk / gün · Yoğun çalışma' },
]

// ────────────────────────────────────────────────────────────────────────────
// Screen
// ────────────────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter()
  const [stepIdx, setStepIdx] = useState(0)
  const [level, setLevel] = useState<string>('B1')
  const [goal, setGoal] = useState<number>(10)

  // Single animated value drives the cross-fade between steps.
  const stepAnim = useRef(new Animated.Value(0)).current
  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current
  // Background hue pan
  const bgAnim = useRef(new Animated.Value(0)).current

  const step = STEPS[stepIdx]
  const total = STEPS.length

  useEffect(() => {
    // Slide-in cross-fade on step change
    stepAnim.setValue(0)
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()

    Animated.timing(progressAnim, {
      toValue: (stepIdx + 1) / total,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()

    // Background glow position drifts as we progress
    Animated.timing(bgAnim, {
      toValue: stepIdx,
      duration: 700,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [stepIdx])

  async function finish() {
    try {
      await AsyncStorage.multiSet([
        ['onboarding_done', 'true'],
        ['user_level', level],
        ['user_daily_goal', String(goal)],
      ])
    } catch (e) {
      console.warn('[onboarding] persist failed:', e)
    }
    router.replace('/auth/login')
  }

  function goNext() {
    if (stepIdx < total - 1) setStepIdx((i) => i + 1)
    else finish()
  }

  function goBack() {
    if (stepIdx > 0) setStepIdx((i) => i - 1)
  }

  function skipToEnd() {
    setStepIdx(total - 1)
  }

  // Animated style for incoming step content
  const contentOpacity = stepAnim
  const contentTranslate = stepAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })

  const bgX = bgAnim.interpolate({
    inputRange: [0, total - 1],
    outputRange: [-60, 60],
  })
  const bgY = bgAnim.interpolate({
    inputRange: [0, total - 1],
    outputRange: [-40, 40],
  })

  // Determine if "Next" should be enabled
  const canProceed =
    step.kind === 'level' ? !!level :
    step.kind === 'goal'  ? !!goal :
    true

  const accent =
    step.kind === 'feature' ? step.accent :
    step.kind === 'level'   ? (cefrColors[level] || colors.accent) :
    colors.accent

  return (
    <SafeAreaView style={styles.container}>
      {/* Ambient glow */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          { backgroundColor: accent + '22', transform: [{ translateX: bgX }, { translateY: bgY }] },
        ]}
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={[styles.iconBtn, { opacity: stepIdx === 0 ? 0 : 1 }]}
          disabled={stepIdx === 0}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
        </Pressable>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: accent,
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>

        {step.kind !== 'finish' && step.kind !== 'welcome' ? (
          <TouchableOpacity onPress={skipToEnd} style={styles.skipBtn}>
            <Text style={styles.skipText}>Atla</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* Step content */}
      <Animated.View
        style={[
          styles.stepContent,
          { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] },
        ]}
      >
        {step.kind === 'welcome' && <WelcomeStep />}
        {step.kind === 'feature' && <FeatureCard step={step} />}
        {step.kind === 'level'   && <LevelStep value={level} onChange={setLevel} />}
        {step.kind === 'goal'    && <GoalStep value={goal} onChange={setGoal} />}
        {step.kind === 'finish'  && <FinishStep level={level} goal={goal} />}
      </Animated.View>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.ctaBtn,
            { backgroundColor: accent },
            !canProceed && { opacity: 0.4 },
          ]}
          disabled={!canProceed}
          onPress={goNext}
        >
          <Text style={styles.ctaText}>
            {step.kind === 'welcome' ? 'Başlayalım' :
             step.kind === 'finish'  ? 'Lexify\'a Hoş Geldin' : 'Devam Et'}
          </Text>
          <Ionicons
            name={step.kind === 'finish' ? 'sparkles' : 'arrow-forward'}
            size={18}
            color={colors.bg}
          />
        </TouchableOpacity>

        {step.kind === 'welcome' && (
          <Text style={styles.footerHint}>
            60 saniye, kişiselleştirme — sonra hemen başlayacaksın.
          </Text>
        )}
      </View>
    </SafeAreaView>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Step components
// ────────────────────────────────────────────────────────────────────────────

function WelcomeStep() {
  // Pulsing logo dot
  const pulse = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ).start()
  }, [])
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] })
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.1] })

  return (
    <View style={styles.welcomeWrap}>
      <View style={styles.brandWrap}>
        <View style={styles.logoStack}>
          <Animated.View style={[styles.logoRing, { transform: [{ scale }], opacity }]} />
          <View style={styles.logoDot} />
        </View>
        <Text style={styles.brand}>Lexify</Text>
      </View>

      <Text style={styles.welcomeTitle}>
        İngilizce kelime{'\n'}öğreniminin{' '}
        <Text style={{ color: colors.accent }}>modern</Text> hali
      </Text>

      <Text style={styles.welcomeSub}>
        Gerçek içeriklerden, kendi temponda, bilimsel aralıklı tekrarla. Sıkıcı kelime listeleri yok.
      </Text>

      <View style={styles.bulletList}>
        {[
          { icon: 'flash-outline', text: 'Tek dokunuşta çeviri' },
          { icon: 'shield-checkmark-outline', text: 'Reklamsız, takipsiz' },
          { icon: 'sync-outline', text: 'Bulut senkronizasyon' },
        ].map((b) => (
          <View key={b.icon} style={styles.bulletRow}>
            <View style={styles.bulletDot}>
              <Ionicons name={b.icon as any} size={14} color={colors.accent} />
            </View>
            <Text style={styles.bulletText}>{b.text}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function FeatureCard({ step }: { step: FeatureStep }) {
  // Icon pop-in
  const pop = useRef(new Animated.Value(0)).current
  useEffect(() => {
    pop.setValue(0)
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start()
  }, [step])
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })

  return (
    <View style={styles.featureWrap}>
      <Animated.View
        style={[
          styles.iconRing,
          { borderColor: step.accent + '40', backgroundColor: step.accent + '0f', transform: [{ scale }] },
        ]}
      >
        <View style={[styles.iconInner, { backgroundColor: step.accent + '1f' }]}>
          <Ionicons name={step.icon} size={48} color={step.accent} />
        </View>
      </Animated.View>

      <Text style={[styles.eyebrow, { color: step.accent }]}>{step.eyebrow}</Text>
      <Text style={styles.featureTitle}>{step.title}</Text>
      <Text style={styles.featureDesc}>{step.desc}</Text>

      <View style={[styles.highlightCard, { borderColor: step.accent + '40' }]}>
        <Text style={styles.highlightLabel}>{step.highlight.label}</Text>
        <Text style={[styles.highlightValue, { color: step.accent }]}>{step.highlight.value}</Text>
      </View>
    </View>
  )
}

function LevelStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepEyebrow}>SENİ TANIYALIM</Text>
      <Text style={styles.stepTitle}>İngilizce seviyen nedir?</Text>
      <Text style={styles.stepSub}>
        Sana doğru zorlukta kelimeler önerebilmemiz için. İstediğin zaman ayarlardan değiştirebilirsin.
      </Text>

      <View style={styles.optionList}>
        {CEFR_OPTIONS.map((opt) => {
          const active = opt.value === value
          const tone = cefrColors[opt.value] || colors.accent
          return (
            <TouchableOpacity
              key={opt.value}
              activeOpacity={0.85}
              style={[
                styles.optionRow,
                active && { borderColor: tone, backgroundColor: tone + '12' },
              ]}
              onPress={() => onChange(opt.value)}
            >
              <View style={[styles.levelBadge, { borderColor: tone, backgroundColor: tone + '22' }]}>
                <Text style={[styles.levelBadgeText, { color: tone }]}>{opt.value}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionSub}>{opt.desc}</Text>
              </View>
              <View style={[styles.radio, active && { borderColor: tone, backgroundColor: tone }]}>
                {active && <Ionicons name="checkmark" size={14} color={colors.bg} />}
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

function GoalStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.formScroll}>
      <Text style={styles.stepEyebrow}>GÜNLÜK HEDEF</Text>
      <Text style={styles.stepTitle}>Her gün kaç{'\n'}kelime öğreneceksin?</Text>
      <Text style={styles.stepSub}>
        Küçük başla, alışkanlık oluştur. Hedefin haftada bir gün eksik kalırsa seri devam eder.
      </Text>

      <View style={styles.optionList}>
        {GOAL_OPTIONS.map((opt) => {
          const active = opt.value === value
          return (
            <TouchableOpacity
              key={opt.value}
              activeOpacity={0.85}
              style={[
                styles.optionRow,
                active && { borderColor: colors.accent, backgroundColor: colors.accent + '12' },
              ]}
              onPress={() => onChange(opt.value)}
            >
              <View style={[styles.goalNum, active && { borderColor: colors.accent, backgroundColor: colors.accent + '22' }]}>
                <Text style={[styles.goalNumText, active && { color: colors.accent }]}>{opt.value}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  {opt.rec && (
                    <View style={styles.recPill}>
                      <Text style={styles.recPillText}>ÖNERİLEN</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionSub}>{opt.sub}</Text>
              </View>
              <View style={[styles.radio, active && { borderColor: colors.accent, backgroundColor: colors.accent }]}>
                {active && <Ionicons name="checkmark" size={14} color={colors.bg} />}
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function FinishStep({ level, goal }: { level: string; goal: number }) {
  // Confetti-ish float for sparkle
  const float = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start()
  }, [])
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] })

  const tone = cefrColors[level] || colors.accent
  return (
    <View style={styles.finishWrap}>
      <Animated.View style={[styles.finishIcon, { borderColor: colors.accent + '40', transform: [{ translateY }] }]}>
        <Ionicons name="rocket-outline" size={56} color={colors.accent} />
      </Animated.View>

      <Text style={styles.eyebrow}>HER ŞEY HAZIR</Text>
      <Text style={styles.featureTitle}>Profilin{'\n'}kişiselleştirildi</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryIconCircle}>
            <Ionicons name="bar-chart-outline" size={16} color={tone} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Başlangıç seviyen</Text>
            <Text style={styles.summaryValue}>{level} · {CEFR_OPTIONS.find((o) => o.value === level)?.label}</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <View style={[styles.summaryIconCircle, { borderColor: colors.accent + '40' }]}>
            <Ionicons name="trophy-outline" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Günlük hedef</Text>
            <Text style={styles.summaryValue}>{goal} kelime / gün</Text>
          </View>
        </View>
      </View>

      <Text style={styles.finishHint}>
        Hesabını oluşturduğunda kelimelerin ve istatistiklerin{' '}
        <Text style={{ color: colors.text }}>otomatik buluta yedeklenir</Text>.
      </Text>
    </View>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  glow: {
    position: 'absolute',
    top: -120, left: '50%',
    marginLeft: -220,
    width: 440, height: 440,
    borderRadius: 220,
  },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, height: 44,
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: '#1a1a1a', overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  skipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },

  stepContent: { flex: 1, paddingHorizontal: 28, paddingTop: 12, paddingBottom: 8 },

  // Welcome
  welcomeWrap: { flex: 1, justifyContent: 'center' },
  brandWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  logoStack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  logoRing: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.accent,
  },
  logoDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent },
  brand: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1.2 },

  welcomeTitle: {
    fontSize: 38, fontWeight: '800', color: colors.text,
    letterSpacing: -1, lineHeight: 44, marginBottom: 20,
  },
  welcomeSub: {
    fontSize: 16, color: colors.textMuted, lineHeight: 24,
    maxWidth: 320, marginBottom: 32,
  },
  bulletList: { gap: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletDot: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: colors.accent + '18',
    borderWidth: 1, borderColor: colors.accent + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  bulletText: { color: colors.text, fontSize: 14, fontWeight: '500' },

  // Feature
  featureWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  iconRing: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, marginBottom: 28,
  },
  iconInner: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.4,
    marginBottom: 12, color: colors.accent,
  },
  featureTitle: {
    fontSize: 30, fontWeight: '800', color: colors.text,
    textAlign: 'center', letterSpacing: -0.8, lineHeight: 36, marginBottom: 14,
  },
  featureDesc: {
    fontSize: 15, color: colors.textMuted, textAlign: 'center',
    lineHeight: 23, maxWidth: 320, marginBottom: 24,
  },
  highlightCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    width: '100%', maxWidth: 320,
  },
  highlightLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  highlightValue: { fontSize: 16, fontWeight: '800' },

  // Form (level/goal)
  formScroll: { paddingTop: 12, paddingBottom: 12 },
  stepEyebrow: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.4,
    color: colors.accent, marginBottom: 8,
  },
  stepTitle: {
    fontSize: 30, fontWeight: '800', color: colors.text,
    letterSpacing: -0.8, lineHeight: 36, marginBottom: 8,
  },
  stepSub: {
    fontSize: 14, color: colors.textMuted, lineHeight: 21, marginBottom: 20,
  },
  optionList: { gap: 10 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgCard,
    borderRadius: 14, padding: 14,
  },
  levelBadge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  levelBadgeText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  goalNum: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: '#0f0f0f',
  },
  goalNumText: { fontSize: 16, fontWeight: '800', color: colors.text },
  optionLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  optionSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  recPill: {
    backgroundColor: colors.accent + '20',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  recPillText: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#2a2a2a',
    alignItems: 'center', justifyContent: 'center',
  },

  // Finish
  finishWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  finishIcon: {
    width: 132, height: 132, borderRadius: 66,
    backgroundColor: colors.accent + '10',
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  summaryCard: {
    width: '100%', maxWidth: 360,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 16, marginTop: 18, marginBottom: 18,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIconCircle: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#141414',
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  summaryValue: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  finishHint: {
    color: colors.textMuted, fontSize: 13, textAlign: 'center',
    lineHeight: 20, maxWidth: 320,
  },

  // Footer
  footer: { paddingHorizontal: 24, paddingBottom: 28, paddingTop: 8, gap: 10 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 17,
    shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  ctaText: { color: colors.bg, fontWeight: '800', fontSize: 16, letterSpacing: -0.2 },
  footerHint: {
    color: colors.textDim, fontSize: 12, textAlign: 'center',
  },
})
