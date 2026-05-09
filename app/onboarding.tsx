import { useReducer, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, radius } from '../lib/theme'
import { upsertPreferences } from '../lib/preferences'
import { registerForPush, scheduleDailyReminder } from '../lib/notifications'
import { setPushToken } from '../lib/preferences'
import * as Notifications from 'expo-notifications'

type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

interface OnboardingState {
  step: number
  cefrLevel: CefrLevel | null
  interests: string[]
  dailyGoal: number
  reminderHour: number
  reminderMinute: number
  showLevelTest: boolean
  testAnswers: (boolean | null)[]
}

type Action =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SET_CEFR'; level: CefrLevel }
  | { type: 'TOGGLE_INTEREST'; interest: string }
  | { type: 'SET_GOAL'; goal: number }
  | { type: 'SET_REMINDER'; hour: number; minute: number }
  | { type: 'SHOW_LEVEL_TEST' }
  | { type: 'ANSWER_TEST'; index: number; correct: boolean }

const INTERESTS = [
  'Haberler', 'İş İngilizcesi', 'Sınav (TOEFL/IELTS)', 'Edebiyat',
  'Teknoloji', 'Bilim', 'Film/Dizi', 'Seyahat', 'Günlük Konuşma',
]

const GOALS = [5, 10, 15, 20, 30]

const LEVEL_TEST_QUESTIONS = [
  {
    question: 'Which word means "happy"?',
    options: ['Sad', 'Glad', 'Angry', 'Tired'],
    answer: 1,
    level: 'A2',
  },
  {
    question: 'Choose the correct form: "If I ___ you, I would study more."',
    options: ['am', 'was', 'were', 'be'],
    answer: 2,
    level: 'B1',
  },
  {
    question: '"Bite the bullet" means:',
    options: ['Eat something hard', 'Endure a painful situation', 'Be very hungry', 'Shoot quickly'],
    answer: 1,
    level: 'B2',
  },
]

function cefrFromAnswers(answers: (boolean | null)[]): CefrLevel {
  const correct = answers.filter(Boolean).length
  if (correct === 3) return 'B2'
  if (correct === 2) return 'B1'
  if (correct === 1) return 'A2'
  return 'A1'
}

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case 'NEXT':
      return { ...state, step: state.step + 1 }
    case 'BACK':
      if (state.showLevelTest) return { ...state, showLevelTest: false }
      return { ...state, step: Math.max(0, state.step - 1) }
    case 'SET_CEFR':
      return { ...state, cefrLevel: action.level, showLevelTest: false }
    case 'TOGGLE_INTEREST': {
      const has = state.interests.includes(action.interest)
      if (!has && state.interests.length >= 5) return state
      const next = has
        ? state.interests.filter(i => i !== action.interest)
        : [...state.interests, action.interest]
      return { ...state, interests: next }
    }
    case 'SET_GOAL':
      return { ...state, dailyGoal: action.goal }
    case 'SET_REMINDER':
      return { ...state, reminderHour: action.hour, reminderMinute: action.minute }
    case 'SHOW_LEVEL_TEST':
      return { ...state, showLevelTest: true, testAnswers: [null, null, null] }
    case 'ANSWER_TEST': {
      const newAnswers = [...state.testAnswers]
      newAnswers[action.index] = action.correct
      const allAnswered = newAnswers.every(a => a !== null)
      if (allAnswered) {
        const level = cefrFromAnswers(newAnswers)
        return { ...state, testAnswers: newAnswers, cefrLevel: level, showLevelTest: false }
      }
      return { ...state, testAnswers: newAnswers }
    }
    default:
      return state
  }
}

const TOTAL_STEPS = 5

export default function OnboardingScreen() {
  const router = useRouter()
  const [testStep, setTestStep] = useState(0)

  const [state, dispatch] = useReducer(reducer, {
    step: 0,
    cefrLevel: null,
    interests: [],
    dailyGoal: 10,
    reminderHour: 21,
    reminderMinute: 0,
    showLevelTest: false,
    testAnswers: [null, null, null],
  })

  async function finish() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

    await upsertPreferences({
      cefrLevel: state.cefrLevel ?? undefined,
      dailyGoal: state.dailyGoal,
      reminderHour: state.reminderHour,
      reminderMinute: state.reminderMinute,
      reminderEnabled: true,
      interests: state.interests,
      timezone: tz,
      onboardedAt: new Date().toISOString(),
    })

    const { status } = await Notifications.requestPermissionsAsync()
    if (status === 'granted') {
      const token = await registerForPush()
      if (token) await setPushToken(token)
      await scheduleDailyReminder(state.reminderHour, state.reminderMinute)
    } else {
      await upsertPreferences({ reminderEnabled: false })
    }

    await AsyncStorage.setItem('onboarding_done', 'true')
    router.replace('/auth/login')
  }

  function renderProgress() {
    return (
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, i <= state.step && styles.progressDotActive]}
          />
        ))}
      </View>
    )
  }

  function renderLevelTest() {
    const q = LEVEL_TEST_QUESTIONS[testStep]
    if (!q) return null
    return (
      <View style={styles.content}>
        <Text style={styles.testBadge}>Soru {testStep + 1} / {LEVEL_TEST_QUESTIONS.length}</Text>
        <Text style={styles.title}>{q.question}</Text>
        <View style={{ gap: 10, marginTop: 20 }}>
          {q.options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={styles.testOption}
              onPress={() => {
                const correct = i === q.answer
                dispatch({ type: 'ANSWER_TEST', index: testStep, correct })
                if (testStep < LEVEL_TEST_QUESTIONS.length - 1) {
                  setTestStep(s => s + 1)
                } else {
                  setTestStep(0)
                }
              }}
            >
              <Text style={styles.testOptionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  function renderStep() {
    switch (state.step) {
      case 0:
        return (
          <View style={styles.content}>
            <Text style={styles.emoji}>🚀</Text>
            <Text style={styles.title}>Lexify'a Hoş Geldin!</Text>
            <Text style={styles.desc}>
              Günde 10 dakika, 30 günde İngilizce seviyeni bir üst basamağa taşı.{'\n\n'}
              Kişiselleştirilmiş öğrenme yolculuğun başlıyor.
            </Text>
          </View>
        )

      case 1:
        if (state.showLevelTest) return renderLevelTest()
        return (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Hangi seviyedesin?</Text>
            <Text style={styles.desc}>Seviyeni seç ya da hızlı test ile öğren.</Text>
            <View style={styles.chipGrid}>
              {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CefrLevel[]).map(lvl => (
                <TouchableOpacity
                  key={lvl}
                  style={[styles.chip, state.cefrLevel === lvl && styles.chipActive]}
                  onPress={() => dispatch({ type: 'SET_CEFR', level: lvl })}
                >
                  <Text style={[styles.chipText, state.cefrLevel === lvl && styles.chipTextActive]}>
                    {lvl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => { setTestStep(0); dispatch({ type: 'SHOW_LEVEL_TEST' }) }}
            >
              <Text style={styles.outlineBtnText}>🤔 Bilmiyorum — Test Et</Text>
            </TouchableOpacity>
          </ScrollView>
        )

      case 2:
        return (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Ne öğrenmek istiyorsun?</Text>
            <Text style={styles.desc}>En fazla 5 alan seç.</Text>
            <View style={styles.chipGrid}>
              {INTERESTS.map(interest => {
                const selected = state.interests.includes(interest)
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => dispatch({ type: 'TOGGLE_INTEREST', interest })}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {interest}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>
        )

      case 3:
        return (
          <View style={styles.content}>
            <Text style={styles.emoji}>🎯</Text>
            <Text style={styles.title}>Günlük hedefin?</Text>
            <Text style={styles.desc}>Çoğu kullanıcı 10 ile başlar.</Text>
            <View style={styles.chipRow}>
              {GOALS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.goalChip, state.dailyGoal === g && styles.chipActive]}
                  onPress={() => dispatch({ type: 'SET_GOAL', goal: g })}
                >
                  <Text style={[styles.goalChipText, state.dailyGoal === g && styles.chipTextActive]}>
                    {g}
                  </Text>
                  <Text style={[styles.goalChipSub, state.dailyGoal === g && styles.chipTextActive]}>
                    kelime
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )

      case 4:
        return (
          <View style={styles.content}>
            <Text style={styles.emoji}>🔔</Text>
            <Text style={styles.title}>Hatırlatma saatini seç</Text>
            <Text style={styles.desc}>
              Akşam {String(state.reminderHour).padStart(2, '0')}:{String(state.reminderMinute).padStart(2, '0')}'da seni güzel bir kelimeyle uyarayım.
            </Text>
            <View style={styles.timePicker}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>Saat</Text>
                <View style={styles.timeButtons}>
                  {[8, 9, 10, 12, 18, 19, 20, 21, 22].map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.timeChip, state.reminderHour === h && styles.chipActive]}
                      onPress={() => dispatch({ type: 'SET_REMINDER', hour: h, minute: state.reminderMinute })}
                    >
                      <Text style={[styles.timeChipText, state.reminderHour === h && styles.chipTextActive]}>
                        {String(h).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>Dakika</Text>
                <View style={styles.timeButtons}>
                  {[0, 15, 30, 45].map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.timeChip, state.reminderMinute === m && styles.chipActive]}
                      onPress={() => dispatch({ type: 'SET_REMINDER', hour: state.reminderHour, minute: m })}
                    >
                      <Text style={[styles.timeChipText, state.reminderMinute === m && styles.chipTextActive]}>
                        :{String(m).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )

      default:
        return null
    }
  }

  const canProceed =
    state.step === 0 ||
    (state.step === 1 && (state.cefrLevel != null || state.showLevelTest)) ||
    state.step === 2 && state.interests.length > 0 ||
    state.step === 3 ||
    state.step === 4

  const isLast = state.step === TOTAL_STEPS - 1

  return (
    <SafeAreaView style={styles.container}>
      {renderProgress()}

      <View style={{ flex: 1 }}>
        {renderStep()}
      </View>

      <View style={styles.buttons}>
        {state.step > 0 && !state.showLevelTest && (
          <TouchableOpacity onPress={() => dispatch({ type: 'BACK' })} style={styles.backBtn}>
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>
        )}
        {!state.showLevelTest && (
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
            onPress={() => {
              if (!canProceed) return
              if (isLast) finish()
              else dispatch({ type: 'NEXT' })
            }}
            disabled={!canProceed}
          >
            <Text style={styles.nextText}>
              {isLast ? 'Başla 🚀' : 'İleri →'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  progressRow: {
    flexDirection: 'row', gap: 6, justifyContent: 'center',
    paddingTop: Platform.OS === 'web' ? 67 : 16, paddingBottom: 12,
  },
  progressDot: { height: 4, flex: 1, borderRadius: 2, backgroundColor: '#222', maxWidth: 48 },
  progressDotActive: { backgroundColor: colors.accent },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 12 },
  desc: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 16 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: colors.bg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 20 },
  goalChip: {
    width: 72, alignItems: 'center', paddingVertical: 14, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  goalChipText: { fontSize: 20, fontWeight: '800', color: colors.text },
  goalChipSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  outlineBtn: {
    marginTop: 20, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  outlineBtnText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 10, padding: 24 },
  backBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    padding: 16, alignItems: 'center',
  },
  backText: { color: colors.textMuted, fontWeight: '600', fontSize: 15 },
  nextBtn: { flex: 2, backgroundColor: colors.accent, borderRadius: radius.lg, padding: 16, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.4 },
  nextText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  timePicker: { flexDirection: 'row', gap: 24, marginTop: 24 },
  timeColumn: { alignItems: 'center', gap: 8 },
  timeLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  timeButtons: { gap: 8 },
  timeChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
    alignItems: 'center',
  },
  timeChipText: { color: colors.textMuted, fontWeight: '600', fontSize: 15 },
  testBadge: { color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  testOption: {
    width: '100%', backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  testOptionText: { color: colors.text, fontSize: 15, fontWeight: '500' },
})
