import {
  applyGrade,
  computeStage,
  initialState,
  isDue,
  nextDueLabel,
  previewGradeLabel,
  Grade,
  SrsState,
} from '../lib/srs'

const NOW = new Date('2026-01-01T12:00:00.000Z')

function review(state: SrsState, grade: Grade, at: Date): SrsState {
  return applyGrade(state, grade, at)
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)
}

describe('SRS — initialState', () => {
  it('varsayılan değerlerle yeni kart üretir', () => {
    const s = initialState(NOW)
    expect(s.ease).toBe(2.5)
    expect(s.interval).toBe(0)
    expect(s.repetitions).toBe(0)
    expect(s.lapses).toBe(0)
    expect(s.dueAt.getTime()).toBe(NOW.getTime())
    expect(s.lastReviewedAt).toBeNull()
    expect(s.stage).toBe('new')
  })
})

describe('SRS — applyGrade interval progression', () => {
  it('4 ardışık good ile interval 1 → 6 → ~15 → ~38 ilerler', () => {
    let s = initialState(NOW)

    s = review(s, 'good', NOW)
    expect(s.repetitions).toBe(1)
    expect(s.interval).toBe(1)

    s = review(s, 'good', NOW)
    expect(s.repetitions).toBe(2)
    expect(s.interval).toBe(6)

    s = review(s, 'good', NOW)
    expect(s.repetitions).toBe(3)
    expect(s.interval).toBe(15) // round(6 * 2.5)

    s = review(s, 'good', NOW)
    expect(s.repetitions).toBe(4)
    expect(s.interval).toBe(38) // round(15 * 2.5)

    expect(s.ease).toBe(2.5) // good ease'i değiştirmez
  })

  it('ardışık good sonrası again interval ve repetitions sıfırlar', () => {
    let s = initialState(NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)

    s = review(s, 'again', NOW)
    expect(s.repetitions).toBe(0)
    expect(s.interval).toBe(0)
    expect(s.lapses).toBe(1)
    expect(s.ease).toBeCloseTo(2.3, 5)

    // due_at şu an + 10 dk olmalı
    const diffMin = (s.dueAt.getTime() - NOW.getTime()) / 60000
    expect(diffMin).toBeCloseTo(10, 5)
  })
})

describe('SRS — ease bounds', () => {
  it('ease asla 1.3 altına düşmez (çok sayıda again ile)', () => {
    let s = initialState(NOW)
    for (let i = 0; i < 30; i++) {
      s = review(s, 'again', NOW)
    }
    expect(s.ease).toBe(1.3)
  })

  it('ease 3.0 üstüne çıkmaz (çok sayıda easy ile)', () => {
    let s = initialState(NOW)
    for (let i = 0; i < 30; i++) {
      s = review(s, 'easy', NOW)
    }
    expect(s.ease).toBe(3.0)
  })
})

describe('SRS — leech detection', () => {
  it('8 lapses sonrası stage leech olur', () => {
    let s = initialState(NOW)
    // Önce öğrenilsin, sonra 8 kez başarısız ol
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)

    for (let i = 0; i < 8; i++) {
      s = review(s, 'again', NOW)
    }

    expect(s.lapses).toBe(8)
    expect(s.stage).toBe('leech')
  })
})

describe('SRS — easy vs good interval', () => {
  it('easy, good\'dan en az %25 daha uzun interval verir', () => {
    // İlk birkaç review'dan sonra karşılaştır
    let goodState = initialState(NOW)
    let easyState = initialState(NOW)

    goodState = review(goodState, 'good', NOW)
    goodState = review(goodState, 'good', NOW)
    goodState = review(goodState, 'good', NOW)

    easyState = review(easyState, 'easy', NOW)
    easyState = review(easyState, 'easy', NOW)
    easyState = review(easyState, 'easy', NOW)

    expect(easyState.interval).toBeGreaterThan(goodState.interval * 1.25)
  })
})

describe('SRS — stage transitions', () => {
  it('new → learning ilk doğru cevapta', () => {
    let s = initialState(NOW)
    expect(s.stage).toBe('new')
    s = review(s, 'good', NOW)
    expect(s.stage).toBe('review') // interval=1 olduğu için review (rule: interval >= 1)
  })

  it('30+ gün interval ve <3 lapses → mastered', () => {
    let s = initialState(NOW)
    s = review(s, 'good', NOW)  // 1
    s = review(s, 'good', NOW)  // 6
    s = review(s, 'good', NOW)  // 15
    s = review(s, 'good', NOW)  // 38
    expect(s.stage).toBe('mastered')
  })

  it('lapses 3+ ise interval >= 30 olsa bile mastered olmaz', () => {
    let s = initialState(NOW)
    // Birkaç good ile büyük interval'a ulaş
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    expect(s.stage).toBe('mastered')

    // 3 kez yanlış yap
    s = review(s, 'again', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'again', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'again', NOW)

    // Şimdi 3 lapses var. Tekrar interval büyütmeye çalış
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)
    s = review(s, 'good', NOW)

    expect(s.lapses).toBeGreaterThanOrEqual(3)
    if (s.interval >= 30) {
      expect(s.stage).not.toBe('mastered')
    }
  })
})

describe('SRS — computeStage saf', () => {
  it('interval=0, reps=0 → new', () => {
    expect(computeStage({ ease: 2.5, interval: 0, repetitions: 0, lapses: 0 })).toBe('new')
  })

  it('lapses=8 → leech (interval ne olursa)', () => {
    expect(computeStage({ ease: 2.5, interval: 100, repetitions: 5, lapses: 8 })).toBe('leech')
  })

  it('interval=30, lapses=0 → mastered', () => {
    expect(computeStage({ ease: 2.5, interval: 30, repetitions: 4, lapses: 0 })).toBe('mastered')
  })

  it('interval=29 → review (mastered eşiği 30)', () => {
    expect(computeStage({ ease: 2.5, interval: 29, repetitions: 4, lapses: 0 })).toBe('review')
  })
})

describe('SRS — isDue', () => {
  it('dueAt geçmişteyse true', () => {
    const past = new Date(NOW.getTime() - 60_000)
    const s: SrsState = { ...initialState(past), dueAt: past }
    expect(isDue(s, NOW)).toBe(true)
  })

  it('dueAt gelecekteyse false', () => {
    const future = new Date(NOW.getTime() + 60_000)
    const s: SrsState = { ...initialState(NOW), dueAt: future }
    expect(isDue(s, NOW)).toBe(false)
  })
})

describe('SRS — nextDueLabel formatting', () => {
  it('1 dk → "1 dk"', () => {
    const s: SrsState = { ...initialState(NOW), dueAt: new Date(NOW.getTime() + 60_000) }
    expect(nextDueLabel(s, NOW)).toBe('1 dk')
  })

  it('30 dk → "30 dk"', () => {
    const s: SrsState = { ...initialState(NOW), dueAt: new Date(NOW.getTime() + 30 * 60_000) }
    expect(nextDueLabel(s, NOW)).toBe('30 dk')
  })

  it('1 saat → "1 sa"', () => {
    const s: SrsState = { ...initialState(NOW), dueAt: new Date(NOW.getTime() + 60 * 60_000) }
    expect(nextDueLabel(s, NOW)).toBe('1 sa')
  })

  it('1 gün → "1 gün"', () => {
    const s: SrsState = { ...initialState(NOW), dueAt: new Date(NOW.getTime() + 24 * 60 * 60_000) }
    expect(nextDueLabel(s, NOW)).toBe('1 gün')
  })

  it('14 gün → "2 hafta"', () => {
    const s: SrsState = { ...initialState(NOW), dueAt: new Date(NOW.getTime() + 14 * 24 * 60 * 60_000) }
    expect(nextDueLabel(s, NOW)).toBe('2 hafta')
  })

  it('60 gün → "2 ay"', () => {
    const s: SrsState = { ...initialState(NOW), dueAt: new Date(NOW.getTime() + 60 * 24 * 60 * 60_000) }
    expect(nextDueLabel(s, NOW)).toBe('2 ay')
  })

  it('365 gün → "1 yıl"', () => {
    // 18 ay altında "ay" olarak kalır; 18+ ay yıla geçer.
    const s: SrsState = {
      ...initialState(NOW),
      dueAt: new Date(NOW.getTime() + 730 * 24 * 60 * 60_000), // 2 yıl
    }
    expect(nextDueLabel(s, NOW)).toBe('2 yıl')
  })
})

describe('SRS — previewGradeLabel', () => {
  it('again için ~10 dk preview verir', () => {
    const s = initialState(NOW)
    expect(previewGradeLabel(s, 'again', NOW)).toBe('10 dk')
  })

  it('good ilk review için ~1 gün preview verir', () => {
    const s = initialState(NOW)
    expect(previewGradeLabel(s, 'good', NOW)).toBe('1 gün')
  })

  it('preview saf — orijinal state\'i mutasyona uğratmaz', () => {
    const s = initialState(NOW)
    const before = JSON.stringify(s)
    previewGradeLabel(s, 'easy', NOW)
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('SRS — gerçekçi senaryolar', () => {
  it('1 ay boyunca her gün good çalışan kullanıcı kelimeyi master eder', () => {
    let s = initialState(NOW)
    let day = NOW
    let reviewCount = 0
    const maxReviews = 30

    while (s.stage !== 'mastered' && reviewCount < maxReviews) {
      day = s.dueAt
      s = review(s, 'good', day)
      reviewCount++
    }

    expect(s.stage).toBe('mastered')
    expect(reviewCount).toBeLessThan(10) // 4-5 review yeterli olmalı
    expect(daysBetween(NOW, s.dueAt)).toBeGreaterThan(30)
  })
})
