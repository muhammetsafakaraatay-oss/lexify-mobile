import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from '../lib/theme'
import { Ionicons } from '@expo/vector-icons'

const { width } = Dimensions.get('window')

const slides = [
  {
    icon: 'book-outline' as const,
    accent: '#facc15',
    title: 'Makale Okurken Öğren',
    desc: 'İngilizce makale veya YouTube videosu aç. Bilmediğin kelimeye dokun, anında Türkçe çeviri al.',
  },
  {
    icon: 'layers-outline' as const,
    accent: '#60a5fa',
    title: 'Flashcard ile Pekiştir',
    desc: "Kaydettiğin kelimeler otomatik olarak flashcard'a eklenir. SM-2 algoritması tekrar zamanını ayarlar.",
  },
  {
    icon: 'bar-chart-outline' as const,
    accent: '#4ade80',
    title: 'CEFR Seviyeni Takip Et',
    desc: "A1'den C2'ye her kelimenin seviyesini gör. Ne kadar ilerlediğini gerçek zamanlı izle.",
  },
  {
    icon: 'camera-outline' as const,
    accent: '#e879f9',
    title: 'Kamerayla Tara',
    desc: 'Menü, tabela, kitap — herhangi bir metni kamerayla tara. Kelimeler hemen tercüme edilir.',
  },
]

export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const router = useRouter()

  async function finish() {
    await AsyncStorage.setItem('onboarding_done', 'true')
    router.replace('/auth/login')
  }

  function goNext() {
    if (current < slides.length - 1) {
      const next = current + 1
      setCurrent(next)
      scrollRef.current?.scrollTo({ x: next * width, animated: true })
    } else {
      finish()
    }
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width)
    setCurrent(idx)
  }

  const slide = slides[current]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.skipRow}>
        {current < slides.length - 1 ? (
          <TouchableOpacity onPress={finish} style={styles.skipBtn}>
            <Text style={styles.skipText}>Atla</Text>
          </TouchableOpacity>
        ) : <View />}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {slides.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={[styles.iconRing, { borderColor: s.accent + '33', backgroundColor: s.accent + '12' }]}>
              <View style={[styles.iconInner, { backgroundColor: s.accent + '22' }]}>
                <Ionicons name={s.icon} size={44} color={s.accent} />
              </View>
            </View>
            <Text style={[styles.slideNum, { color: s.accent }]}>{i + 1} / {slides.length}</Text>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.desc}>{s.desc}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === current
                  ? [styles.dotActive, { backgroundColor: slide.accent, width: 28 }]
                  : { backgroundColor: '#2a2a2a' },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.accent }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextText}>
            {current === slides.length - 1 ? 'Başla' : 'İleri'}
          </Text>
          <Ionicons
            name={current === slides.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={20}
            color={colors.bg}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 8, height: 44 },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  iconRing: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, marginBottom: 32,
  },
  iconInner: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  slideNum: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 16, opacity: 0.8 },
  title: {
    fontSize: 28, fontWeight: '800', color: colors.text,
    textAlign: 'center', marginBottom: 16, letterSpacing: -0.5, lineHeight: 34,
  },
  desc: {
    fontSize: 16, color: colors.textMuted,
    textAlign: 'center', lineHeight: 25, maxWidth: 300,
  },

  footer: { paddingHorizontal: 28, paddingBottom: 32, gap: 24 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { height: 6, borderRadius: 3 },

  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 18, paddingVertical: 18,
    shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  nextText: { color: colors.bg, fontWeight: '800', fontSize: 17 },
})
