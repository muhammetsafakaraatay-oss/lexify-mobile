import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { usePremium } from '../../contexts/SubscriptionContext'
import { FREE_LIMITS } from '../../lib/plan'
import { listUniqueSavedWords } from '../../lib/data'
import { getTodaySaveCount } from '../../lib/usage'

export function FreePlanBanner() {
  const { isPro } = usePremium()
  const router = useRouter()
  const [total, setTotal] = useState(0)
  const [todaySaves, setTodaySaves] = useState(0)

  useEffect(() => {
    if (isPro) return
    void (async () => {
      const [words, saves] = await Promise.all([
        listUniqueSavedWords(),
        getTodaySaveCount(),
      ])
      setTotal(words.length)
      setTodaySaves(saves)
    })()
  }, [isPro])

  if (isPro) return null

  const wordsLeft = Math.max(0, FREE_LIMITS.maxSavedWords - total)
  const savesLeft = Math.max(0, FREE_LIMITS.maxSavesPerDay - todaySaves)
  const nearLimit = wordsLeft <= 5 || savesLeft <= 2

  if (!nearLimit && total < FREE_LIMITS.maxSavedWords * 0.6) return null

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => router.push('/paywall')}
      activeOpacity={0.9}
    >
      <Ionicons name="diamond-outline" size={18} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Ücretsiz plan</Text>
        <Text style={styles.sub}>
          {wordsLeft} kelime · bugün {savesLeft} kayıt hakkı kaldı
        </Text>
      </View>
      <Text style={styles.cta}>Pro →</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.25)',
  },
  title: { color: colors.text, fontSize: 13, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  cta: { color: colors.accent, fontSize: 12, fontWeight: '800' },
})
