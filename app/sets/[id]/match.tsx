/**
 * Match mode — tap-to-pair grid.
 * Takes up to 8 terms (16 cards = term + translation each) and shuffles them.
 * Timer starts on first tap. Match all pairs to finish.
 * Best time per set is saved via recordMatchTime.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import { getSet, populateSet, recordMatchTime, type PopulatedSet } from '../../../lib/sets'
import type { SavedWord } from '../../../lib/data'

const { width } = Dimensions.get('window')
const GUTTER = 8
const GRID_PADDING = 16
const COLS = 4
const CARD_W = Math.floor((width - GRID_PADDING * 2 - GUTTER * (COLS - 1)) / COLS)
const CARD_H = Math.round(CARD_W * 1.25)

const MAX_PAIRS = 8

type Side = 'term' | 'def'

interface MatchCard {
  id: string         // unique card id (termId + side)
  termId: string
  side: Side
  label: string
  matched: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildBoard(terms: SavedWord[]): MatchCard[] {
  const usable = terms.filter((t) => !!t.translation).slice(0, MAX_PAIRS)
  const cards: MatchCard[] = []
  for (const t of usable) {
    cards.push({ id: `${t.id}::term`, termId: t.id, side: 'term', label: t.word, matched: false })
    cards.push({ id: `${t.id}::def`, termId: t.id, side: 'def', label: t.translation || '—', matched: false })
  }
  return shuffle(cards)
}

function formatTime(ms: number): string {
  const sec = ms / 1000
  return sec.toFixed(1) + 's'
}

export default function MatchScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [set, setSet] = useState<PopulatedSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<MatchCard[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [endTime, setEndTime] = useState<number | null>(null)
  const [now, setNow] = useState<number>(0)
  const [moves, setMoves] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let alive = true
    if (!id) return
    ;(async () => {
      const raw = await getSet(id)
      const populated = await populateSet(raw)
      if (!alive) return
      setSet(populated)
      if (populated) setCards(buildBoard(populated.terms))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [id])

  // Tick timer
  useEffect(() => {
    if (startTime !== null && endTime === null) {
      tickRef.current = setInterval(() => setNow(Date.now()), 100)
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [startTime, endTime])

  const elapsedMs = useMemo(() => {
    if (startTime === null) return 0
    const end = endTime ?? now
    return Math.max(0, end - startTime)
  }, [startTime, endTime, now])

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length / 2, [cards])
  const totalPairs = cards.length / 2

  // Check completion
  useEffect(() => {
    if (totalPairs > 0 && matchedCount === totalPairs && endTime === null && startTime !== null) {
      const finishedAt = Date.now()
      setEndTime(finishedAt)
      if (set) {
        void recordMatchTime(set.id, (finishedAt - startTime) / 1000)
      }
    }
  }, [matchedCount, totalPairs, endTime, startTime, set])

  const handleTap = useCallback((card: MatchCard) => {
    if (card.matched || endTime !== null) return
    if (wrongPair) return  // briefly blocked while showing wrong flash

    if (startTime === null) setStartTime(Date.now())

    // No selection yet → just select
    if (!selectedId) {
      setSelectedId(card.id)
      return
    }
    // Tapping the same card → deselect
    if (selectedId === card.id) {
      setSelectedId(null)
      return
    }

    const previous = cards.find((c) => c.id === selectedId)
    if (!previous) {
      setSelectedId(card.id)
      return
    }

    setMoves((m) => m + 1)

    // Match?
    const isPair = previous.termId === card.termId && previous.side !== card.side
    if (isPair) {
      setCards((prev) =>
        prev.map((c) => (c.termId === card.termId ? { ...c, matched: true } : c)),
      )
      setSelectedId(null)
    } else {
      setWrongPair([previous.id, card.id])
      setSelectedId(null)
      setTimeout(() => setWrongPair(null), 500)
    }
  }, [cards, selectedId, startTime, endTime, wrongPair])

  function restart() {
    if (!set) return
    setCards(buildBoard(set.terms))
    setSelectedId(null)
    setWrongPair(null)
    setStartTime(null)
    setEndTime(null)
    setNow(0)
    setMoves(0)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      </SafeAreaView>
    )
  }

  if (!set || totalPairs === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.title}>Bu set Match için yetersiz</Text>
          <Text style={styles.sub}>En az 4 çeviri-içeren kelime gerekli.</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.back()}>
            <Text style={styles.btnPrimaryText}>Sete dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const finished = endTime !== null
  const seconds = elapsedMs / 1000
  const newBest = finished && set.bestMatchSeconds !== undefined && seconds <= set.bestMatchSeconds

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topTitle} numberOfLines={1}>{set.name}</Text>
          <Text style={styles.topSub}>Match</Text>
        </View>
        <TouchableOpacity onPress={restart} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="refresh-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Ionicons name="timer-outline" size={13} color="#60a5fa" />
          <Text style={[styles.statChipText, { color: '#60a5fa' }]}>{formatTime(elapsedMs)}</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="grid-outline" size={13} color={colors.textMuted} />
          <Text style={styles.statChipText}>{matchedCount}/{totalPairs}</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="swap-horizontal-outline" size={13} color={colors.textMuted} />
          <Text style={styles.statChipText}>{moves} hamle</Text>
        </View>
        {set.bestMatchSeconds !== undefined ? (
          <View style={[styles.statChip, { backgroundColor: colors.accentDim }]}>
            <Ionicons name="trophy-outline" size={13} color={colors.accent} />
            <Text style={[styles.statChipText, { color: colors.accent }]}>en iyi {set.bestMatchSeconds.toFixed(1)}s</Text>
          </View>
        ) : null}
      </View>

      {/* Grid */}
      <View style={styles.gridWrap}>
        <View style={styles.grid}>
          {cards.map((card) => {
            const isSelected = selectedId === card.id
            const isWrong = wrongPair && (wrongPair[0] === card.id || wrongPair[1] === card.id)
            return (
              <MatchTile
                key={card.id}
                card={card}
                selected={!!isSelected}
                wrong={!!isWrong}
                onPress={() => handleTap(card)}
              />
            )
          })}
        </View>
      </View>

      {/* Finish overlay */}
      {finished ? (
        <View style={styles.finishCard}>
          <Ionicons name="trophy" size={36} color={colors.accent} />
          <Text style={styles.finishTitle}>{formatTime(elapsedMs)}</Text>
          <Text style={styles.finishSub}>
            {moves} hamle · {totalPairs} çift {newBest ? '· yeni rekor!' : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => router.replace(`/sets/${set.id}`)}>
              <Text style={styles.btnSecondaryText}>Sete dön</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={restart}>
              <Text style={styles.btnPrimaryText}>Tekrar oyna</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  )
}

function MatchTile({
  card, selected, wrong, onPress,
}: {
  card: MatchCard
  selected: boolean
  wrong: boolean
  onPress: () => void
}) {
  const fade = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (card.matched) {
      Animated.timing(fade, { toValue: 0.0, duration: 280, useNativeDriver: true }).start()
    } else {
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    }
  }, [card.matched, fade])

  return (
    <Animated.View style={{
      width: CARD_W, height: CARD_H, marginBottom: GUTTER,
      opacity: fade,
      transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
    }}>
      <Pressable
        onPress={onPress}
        disabled={card.matched}
        style={[
          tileStyles.tile,
          card.side === 'term' ? tileStyles.tileTerm : tileStyles.tileDef,
          selected && tileStyles.tileSelected,
          wrong && tileStyles.tileWrong,
        ]}
      >
        <Text
          style={[
            tileStyles.tileLabel,
            card.side === 'term' ? tileStyles.tileLabelTerm : tileStyles.tileLabelDef,
          ]}
          numberOfLines={4}
        >
          {card.label}
        </Text>
        <View style={tileStyles.sideTag}>
          <Text style={tileStyles.sideTagText}>
            {card.side === 'term' ? 'EN' : 'TR'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  topTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  topSub: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 2 },

  statsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12, flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  statChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },

  gridWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GUTTER, paddingHorizontal: GRID_PADDING, justifyContent: 'center',
  },

  finishCard: {
    position: 'absolute', bottom: 24, left: 20, right: 20,
    backgroundColor: colors.bgCard, borderRadius: 22,
    borderWidth: 1, borderColor: colors.border,
    padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5, shadowRadius: 28, elevation: 18,
  },
  finishTitle: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 6 },
  finishSub: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  btnPrimary: {
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
  },
  btnPrimaryText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  btnSecondary: {
    backgroundColor: colors.bg, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border,
  },
  btnSecondaryText: { color: colors.text, fontWeight: '700', fontSize: 14 },
})

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1, borderRadius: 14, padding: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  tileTerm: {
    backgroundColor: 'rgba(168,85,247,0.10)',
    borderColor: 'rgba(168,85,247,0.45)',
  },
  tileDef: {
    backgroundColor: 'rgba(34,211,238,0.10)',
    borderColor: 'rgba(34,211,238,0.45)',
  },
  tileSelected: {
    borderColor: colors.accent, backgroundColor: colors.accentDim,
    shadowColor: colors.accent, shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  tileWrong: {
    borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.18)',
  },
  tileLabel: {
    fontSize: 13, fontWeight: '800', textAlign: 'center',
  },
  tileLabelTerm: { color: '#e9d5ff' },
  tileLabelDef: { color: '#a5f3fc' },
  sideTag: {
    position: 'absolute', top: 6, left: 6,
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sideTagText: {
    color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5,
  },
})
