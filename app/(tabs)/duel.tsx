import { useCallback, useMemo, useState } from 'react'
import { Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { listUniqueSavedWords } from '../../lib/data'
import { colors } from '../../lib/theme'
import { createDuelChallenge, decodeDuelPayload, encodeDuelPayload, DuelChallenge } from '../../lib/duel'
import { supabase } from '../../lib/supabase'

export default function DuelScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ payload?: string }>()
  const [message, setMessage] = useState('Bunları benden iyi mi bileceksin?')
  const [created, setCreated] = useState<DuelChallenge | null>(null)
  const [incoming, setIncoming] = useState<DuelChallenge | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (typeof params.payload === 'string') {
        const duel = decodeDuelPayload(params.payload)
        setIncoming(duel)
      }
    }, [params.payload]),
  )

  async function handleCreate() {
    const words = await listUniqueSavedWords({ orderBy: 'review_count', ascending: true, limit: 24 })
    if (words.length < 5) {
      Alert.alert('Henüz hazır değil', 'Düello oluşturmak için en az 5 kayıtlı kelime gerekiyor.')
      return
    }
    const { data } = await supabase.auth.getUser()
    const senderName = data.user?.user_metadata?.full_name?.split(' ')[0] || 'Lexfly oyuncusu'
    const duel = createDuelChallenge(words, senderName, message.trim() || 'Meydan oku')
    setCreated(duel)
    const payload = encodeDuelPayload(duel)
    await Share.share({
      message: `Lexfly meydan okuması: ${senderName} seni kelime quiz'ine çağırdı.\n\nUygulamada şu challenge kodunu aç:\n${payload}`,
    })
  }

  const activeQuestion = useMemo(() => incoming?.questions[questionIndex] || null, [incoming, questionIndex])

  function answer(option: string) {
    if (!activeQuestion || !incoming) return
    if (option === activeQuestion.correct) setScore((prev) => prev + 1)
    if (questionIndex >= incoming.questions.length - 1) {
      setDone(true)
      return
    }
    setQuestionIndex((prev) => prev + 1)
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Düello</Text>
        <Text style={styles.subtitle}>Arkadaşının kelimelerinden mini quiz üret. Şimdilik paylaşım kodu ile çalışıyor.</Text>

        {!incoming ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Meydan okuma oluştur</Text>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Mesajın..."
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleCreate()}>
              <Text style={styles.primaryText}>5 Soruluk Düello Oluştur</Text>
            </TouchableOpacity>
            {created ? <Text style={styles.helper}>Challenge oluşturuldu. Paylaşım ekranı açıldı.</Text> : null}
          </View>
        ) : done ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Düello bitti</Text>
            <Text style={styles.bigScore}>{score} / {incoming.questions.length}</Text>
            <Text style={styles.helper}>{incoming.senderName} tarafından gönderilen meydan okumayı tamamladın.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)/study')}>
              <Text style={styles.primaryText}>Sen de Düello Oluştur</Text>
            </TouchableOpacity>
          </View>
        ) : activeQuestion ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{incoming.senderName} sana meydan okudu</Text>
            <Text style={styles.helper}>{incoming.message}</Text>
            <Text style={styles.progress}>{questionIndex + 1} / {incoming.questions.length}</Text>
            <Text style={styles.questionWord}>{activeQuestion.word}</Text>
            <View style={styles.options}>
              {activeQuestion.options.map((option) => (
                <TouchableOpacity key={option} style={styles.optionBtn} onPress={() => answer(option)}>
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 18 },
  card: { backgroundColor: colors.bgCard, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  input: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontSize: 14, marginBottom: 12 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  helper: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  progress: { color: colors.accent, fontSize: 12, fontWeight: '800', marginBottom: 10 },
  questionWord: { color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 14 },
  options: { gap: 10 },
  optionBtn: { backgroundColor: '#101010', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  optionText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  bigScore: { color: colors.accent, fontSize: 42, fontWeight: '900' },
})
