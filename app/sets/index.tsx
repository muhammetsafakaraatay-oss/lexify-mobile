import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { listSets, type StudySet } from '../../lib/sets'

export default function SetsIndexScreen() {
  const router = useRouter()
  const [sets, setSets] = useState<StudySet[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      let alive = true
      setLoading(true)
      listSets()
        .then((rows) => alive && setSets(rows))
        .finally(() => alive && setLoading(false))
      return () => {
        alive = false
      }
    }, []),
  )

  function renderItem({ item }: { item: StudySet }) {
    const total = item.termIds.length
    const mastered = item.termIds.filter((id) => (item.mastery[id] ?? 0) >= 1).length
    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0

    return (
      <TouchableOpacity
        style={styles.setCard}
        activeOpacity={0.86}
        onPress={() => router.push(`/sets/${item.id}`)}
      >
        <View style={styles.setHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.setName} numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.setDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
          </View>
          <View style={styles.percentRing}>
            <Text style={styles.percentText}>{percent}%</Text>
          </View>
        </View>

        <View style={styles.setStatsRow}>
          <View style={styles.stat}>
            <Ionicons name="library-outline" size={13} color={colors.textMuted} />
            <Text style={styles.statText}>{total} terim</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="checkmark-done-outline" size={13} color="#4ade80" />
            <Text style={styles.statText}>{mastered} öğrenildi</Text>
          </View>
          {item.bestMatchSeconds !== undefined ? (
            <View style={styles.stat}>
              <Ionicons name="timer-outline" size={13} color="#60a5fa" />
              <Text style={styles.statText}>{item.bestMatchSeconds.toFixed(1)}s</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Setlerim</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/sets/new')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={colors.bg} />
          <Text style={styles.newBtnText}>Yeni Set</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : sets.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="albums-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Henüz set yok</Text>
          <Text style={styles.emptyDesc}>
            Kayıtlı kelimelerini gruplayarak Quizlet tarzı çalışma setleri oluştur. Her sette flashcard, Learn ve Match modunu birlikte kullan.
          </Text>
          <TouchableOpacity
            style={styles.bigCta}
            onPress={() => router.push('/sets/new')}
            activeOpacity={0.86}
          >
            <Ionicons name="add-circle" size={20} color={colors.bg} />
            <Text style={styles.bigCtaText}>İlk setini oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
  },
  topTitle: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800', marginLeft: 6 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  newBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  bigCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 999, marginTop: 8,
  },
  bigCtaText: { color: colors.bg, fontWeight: '800', fontSize: 14 },

  setCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  setHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  setName: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  setDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  percentRing: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentDim,
  },
  percentText: { color: colors.accent, fontSize: 12, fontWeight: '900' },

  setStatsRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  progressTrack: {
    height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden', marginTop: 4,
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
})
