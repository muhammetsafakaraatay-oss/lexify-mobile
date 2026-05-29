// Lexify · Match mode game logic hook
// Owns: tiles state, selection, scoring, streak bonus, timer, completion.
// UI-agnostic so it can be unit-tested without RN renderer.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type { FlashcardCard } from '../lib/flashcards'

export type Column = 'front' | 'back'

export type Tile = {
  key: string         // unique
  pairId: string      // card.id; same for front+back tiles
  text: string        // text shown in the tile
  column: Column      // which column it lives in
  matched: boolean
  wrong: boolean      // transient — currently in red shake state
}

export type MatchResult =
  | { kind: 'match'; pairId: string; aKey: string; bKey: string; cardFront: string; cardBack: string }
  | { kind: 'wrong'; aKey: string; bKey: string }
  | { kind: 'noop' }

export type MatchOutcome = {
  score: number
  duration: number   // seconds
  correct: number
  wrong: number
  maxStreak: number
}

export type UseMatchGameOptions = {
  cards: FlashcardCard[]            // pre-selected (e.g. 6) cards
  onResult?: (r: MatchResult) => void
  onComplete?: (o: MatchOutcome) => void
  onTimeUp?: (o: MatchOutcome) => void
  enabled: boolean                  // start ticking only once countdown finished
}

const SECONDS_BY_PAIRS: Record<number, number> = { 6: 60, 8: 75, 10: 90 }

function defaultSecondsFor(pairs: number): number {
  if (SECONDS_BY_PAIRS[pairs]) return SECONDS_BY_PAIRS[pairs]
  // Linear interp: ~9 seconds per pair, clamped.
  return Math.max(40, Math.min(120, Math.round(pairs * 9 + 6)))
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildTiles(cards: FlashcardCard[]): { left: Tile[]; right: Tile[] } {
  const left: Tile[] = cards.map((c) => ({
    key: `${c.id}-f`,
    pairId: c.id,
    text: c.front,
    column: 'front',
    matched: false,
    wrong: false,
  }))
  const right: Tile[] = cards.map((c) => ({
    key: `${c.id}-b`,
    pairId: c.id,
    text: c.back,
    column: 'back',
    matched: false,
    wrong: false,
  }))
  return { left: shuffle(left), right: shuffle(right) }
}

function streakBonus(currentStreak: number): number {
  // Bonus added on top of the base +10 for each correct match.
  if (currentStreak >= 4) return 15
  if (currentStreak === 3) return 10
  if (currentStreak === 2) return 5
  return 0
}

export function useMatchGame(opts: UseMatchGameOptions) {
  const { cards, onResult, onComplete, onTimeUp, enabled } = opts
  const pairs = cards.length
  const totalSeconds = useMemo(() => defaultSecondsFor(pairs), [pairs])

  const initial = useMemo(() => buildTiles(cards), [cards])
  const [left, setLeft] = useState<Tile[]>(initial.left)
  const [right, setRight] = useState<Tile[]>(initial.right)

  // Selected key in each column (only one allowed per column).
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [selectedRight, setSelectedRight] = useState<string | null>(null)

  // Score & streak
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)

  // Time
  const [remaining, setRemaining] = useState(totalSeconds)
  const completedRef = useRef(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Reset whenever the card set changes (restart).
  useEffect(() => {
    const t = buildTiles(cards)
    setLeft(t.left)
    setRight(t.right)
    setSelectedLeft(null)
    setSelectedRight(null)
    setScore(0)
    setStreak(0)
    setMaxStreak(0)
    setCorrect(0)
    setWrong(0)
    setRemaining(totalSeconds)
    completedRef.current = false
  }, [cards, totalSeconds])

  // Timer (1s tick) — only when enabled and not done.
  useEffect(() => {
    if (!enabled || completedRef.current) return
    let id: ReturnType<typeof setInterval> | null = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          if (id) { clearInterval(id); id = null }
          // Defer the callback to avoid setState-in-setState lint.
          const outcome = computeOutcome(0)
          completedRef.current = true
          queueMicrotask(() => onTimeUp?.(outcome))
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (id) clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Pause timer when app backgrounds.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') enabledRef.current = false
    })
    return () => { sub.remove() }
  }, [])

  // Helper to compute outcome snapshot.
  const computeOutcome = useCallback(
    (remainingNow: number): MatchOutcome => {
      const timeBonus = Math.round(Math.max(0, remainingNow) * 0.5)
      return {
        score: score + timeBonus,
        duration: totalSeconds - remainingNow,
        correct,
        wrong,
        maxStreak,
      }
    },
    [score, correct, wrong, maxStreak, totalSeconds],
  )

  // Internal: react to "all matched" condition.
  const checkCompletion = useCallback((nextLeft: Tile[], nextRight: Tile[], remainingNow: number) => {
    const total = nextLeft.length
    const matched = nextLeft.filter((t) => t.matched).length
    if (matched >= total && total > 0 && !completedRef.current) {
      completedRef.current = true
      const outcome = computeOutcome(remainingNow)
      // Defer to next tick so caller animations can run first.
      queueMicrotask(() => onComplete?.(outcome))
    }
  }, [computeOutcome, onComplete])

  // tap a tile
  const tap = useCallback((tile: Tile) => {
    if (completedRef.current || tile.matched || tile.wrong) return

    const col = tile.column
    const otherSel = col === 'front' ? selectedRight : selectedLeft
    const sameColSelected = col === 'front' ? selectedLeft : selectedRight

    // Same column: just move the selection.
    if (sameColSelected && sameColSelected === tile.key) {
      // Deselect on tapping the same tile again.
      if (col === 'front') setSelectedLeft(null)
      else setSelectedRight(null)
      onResult?.({ kind: 'noop' })
      return
    }

    if (sameColSelected !== tile.key) {
      if (col === 'front') setSelectedLeft(tile.key)
      else setSelectedRight(tile.key)
    }

    // If no selection on the OTHER column, just stop here.
    if (!otherSel) {
      onResult?.({ kind: 'noop' })
      return
    }

    // We have one selected on each column → resolve match.
    const leftKey = col === 'front' ? tile.key : (otherSel as string)
    const rightKey = col === 'front' ? (otherSel as string) : tile.key
    const leftTile = left.find((t) => t.key === leftKey)
    const rightTile = right.find((t) => t.key === rightKey)
    if (!leftTile || !rightTile) return

    if (leftTile.pairId === rightTile.pairId) {
      // CORRECT
      const newStreak = streak + 1
      const gained = 10 + streakBonus(newStreak)
      const card = cards.find((c) => c.id === leftTile.pairId)
      setStreak(newStreak)
      setMaxStreak((m) => (newStreak > m ? newStreak : m))
      setScore((s) => s + gained)
      setCorrect((n) => n + 1)
      const nextLeft = left.map((t) => (t.key === leftKey ? { ...t, matched: true } : t))
      const nextRight = right.map((t) => (t.key === rightKey ? { ...t, matched: true } : t))
      setLeft(nextLeft)
      setRight(nextRight)
      setSelectedLeft(null)
      setSelectedRight(null)
      onResult?.({
        kind: 'match',
        pairId: leftTile.pairId,
        aKey: leftKey,
        bKey: rightKey,
        cardFront: card?.front ?? leftTile.text,
        cardBack: card?.back ?? rightTile.text,
      })
      checkCompletion(nextLeft, nextRight, remaining)
    } else {
      // WRONG — flag both as wrong, clear flag after a short shake.
      setStreak(0)
      setWrong((n) => n + 1)
      setLeft((arr) => arr.map((t) => (t.key === leftKey ? { ...t, wrong: true } : t)))
      setRight((arr) => arr.map((t) => (t.key === rightKey ? { ...t, wrong: true } : t)))
      onResult?.({ kind: 'wrong', aKey: leftKey, bKey: rightKey })
      setTimeout(() => {
        setLeft((arr) => arr.map((t) => (t.key === leftKey ? { ...t, wrong: false } : t)))
        setRight((arr) => arr.map((t) => (t.key === rightKey ? { ...t, wrong: false } : t)))
        setSelectedLeft(null)
        setSelectedRight(null)
      }, 380)
    }
  }, [
    cards, left, right,
    selectedLeft, selectedRight,
    streak, remaining,
    onResult, checkCompletion,
  ])

  // Outcome accessor (for screens that need an interim snapshot)
  const outcome = useMemo(
    () => computeOutcome(remaining),
    [computeOutcome, remaining],
  )

  return {
    // State
    left, right,
    selectedLeft, selectedRight,
    score, streak, maxStreak,
    correct, wrong,
    remaining, totalSeconds,
    completed: completedRef.current,
    // Actions
    tap,
    outcome,
  }
}
