/**
 * Generic round-robin learning engine.
 *
 * Each item starts in the queue. On correct → moves to `mastered` and exits
 * rotation. On wrong → goes to the back of the queue AND is flagged for the
 * next round so progressively harder question types can target it.
 *
 * A "round" ends when the queue empties. The engine then re-fills the queue
 * with items that were missed during the round (shuffled).
 */

export interface RoundRobinState<T> {
  queue: T[]
  mastered: T[]
  wrongThisRound: T[]
  round: number
  total: number
  /** id of the last item that was answered wrong — for UI flash. */
  lastWrongId?: string
}

export interface RoundRobinAdapter<T> {
  /** Stable identifier for diffing. */
  idOf: (item: T) => string
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function initRoundRobin<T>(items: T[]): RoundRobinState<T> {
  return {
    queue: shuffle(items),
    mastered: [],
    wrongThisRound: [],
    round: 1,
    total: items.length,
  }
}

export function currentItem<T>(state: RoundRobinState<T>): T | null {
  return state.queue[0] ?? null
}

export function isComplete<T>(state: RoundRobinState<T>): boolean {
  return state.queue.length === 0 && state.wrongThisRound.length === 0
}

export function answerCorrect<T>(
  state: RoundRobinState<T>,
  adapter: RoundRobinAdapter<T>,
): RoundRobinState<T> {
  const head = state.queue[0]
  if (!head) return state
  const id = adapter.idOf(head)

  // Remove from queue and any previous "wrong" tracking for this round.
  const newQueue = state.queue.slice(1)
  const newWrong = state.wrongThisRound.filter((it) => adapter.idOf(it) !== id)
  const alreadyMastered = state.mastered.some((it) => adapter.idOf(it) === id)
  const newMastered = alreadyMastered ? state.mastered : [...state.mastered, head]

  // If queue is empty but we have wrong items, start next round.
  if (newQueue.length === 0 && newWrong.length > 0) {
    return {
      ...state,
      queue: shuffle(newWrong),
      mastered: newMastered,
      wrongThisRound: [],
      round: state.round + 1,
      lastWrongId: undefined,
    }
  }

  return {
    ...state,
    queue: newQueue,
    mastered: newMastered,
    wrongThisRound: newWrong,
    lastWrongId: undefined,
  }
}

export function answerWrong<T>(
  state: RoundRobinState<T>,
  adapter: RoundRobinAdapter<T>,
): RoundRobinState<T> {
  const head = state.queue[0]
  if (!head) return state
  const id = adapter.idOf(head)

  // Push head to the back of the current queue so it gets re-asked, AND
  // record it for the next round.
  const rest = state.queue.slice(1)
  const newQueue = [...rest, head]
  const alreadyTracked = state.wrongThisRound.some((it) => adapter.idOf(it) === id)
  const newWrong = alreadyTracked ? state.wrongThisRound : [...state.wrongThisRound, head]
  // If it was previously mastered, demote.
  const newMastered = state.mastered.filter((it) => adapter.idOf(it) !== id)

  return {
    ...state,
    queue: newQueue,
    wrongThisRound: newWrong,
    mastered: newMastered,
    lastWrongId: id,
  }
}

export function progress<T>(state: RoundRobinState<T>): {
  mastered: number
  remaining: number
  total: number
  percent: number
} {
  const mastered = state.mastered.length
  const total = state.total
  const remaining = total - mastered
  const percent = total > 0 ? Math.round((mastered / total) * 100) : 0
  return { mastered, remaining, total, percent }
}
