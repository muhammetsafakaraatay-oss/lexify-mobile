import { computeStreakFromDates } from '../lib/streak'

describe('computeStreakFromDates', () => {
  it('boş dizide 0 döner', () => {
    expect(computeStreakFromDates([])).toBe(0)
  })

  it('bugün ve dün kesintisiz seri sayar', () => {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const y = yesterday.toISOString().split('T')[0]
    expect(computeStreakFromDates([today, y])).toBe(2)
  })
})
