import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from '../lib/theme'

const { width } = Dimensions.get('window')

const slides = [
  {
    emoji: '📖',
    title: 'Makale Okurken Öğren',
    desc: 'İngilizce makale veya YouTube videosu aç, kelimelere dokun, anında çeviri al.',
  },
  {
    emoji: '🃏',
    title: 'Flashcard ile Tekrar Et',
    desc: 'Kaydettiğin kelimeleri flashcard ve quiz modunda pekiştir.',
  },
  {
    emoji: '📊',
    title: 'CEFR Seviyeni Takip Et',
    desc: 'A1\'den C2\'ye her kelimenin seviyesini gör, gelişimini izle.',
  },
  {
    emoji: '🚀',
    title: 'Hadi Başlayalım!',
    desc: 'Lexify ile İngilizce öğrenmek hiç bu kadar kolay olmamıştı.',
  },
]

export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0)
  const router = useRouter()

  async function finish() {
    await AsyncStorage.setItem('onboarding_done', 'true')
    router.replace('/auth/login')
  }

  const slide = slides[current]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </View>

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.buttons}>
        {current < slides.length - 1 ? (
          <>
            <TouchableOpacity onPress={finish} style={styles.skipBtn}>
              <Text style={styles.skipText}>Atla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrent(c => c + 1)} style={styles.nextBtn}>
              <Text style={styles.nextText}>İleri →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={finish} style={[styles.nextBtn, { flex: 1 }]}>
            <Text style={styles.nextText}>Başla 🚀</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emoji: { fontSize: 80, marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 16 },
  desc: { fontSize: 16, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  dotActive: { backgroundColor: colors.accent, width: 24 },
  buttons: { flexDirection: 'row', gap: 12, padding: 24 },
  skipBtn: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  skipText: { color: colors.textMuted, fontWeight: '600', fontSize: 15 },
  nextBtn: { flex: 1, backgroundColor: colors.accent, padding: 16, alignItems: 'center', borderRadius: 12 },
  nextText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
})
