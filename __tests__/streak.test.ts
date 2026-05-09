import { computeStreak, DailyActivity } from '../lib/streak'

function makeActivity(day: string, goalMet: boolean): DailyActivity {
  return { day, reviewsDone: goalMet ? 10 : 0, wordsAdded: 0, goalMet }
}

describe('computeStreak', () => {
  test('no activities → all zeros', () => {
    const result = computeStreak([], '2024-01-10')
    expect(result.current).toBe(0)
    expect(result.longest).toBe(0)
    expect(result.todayMet).toBe(false)
    expect(result.yesterdayMet).toBe(false)
  })

  test('5 consecutive days goalMet → current=5, longest=5', () => {
    const activities = [
      makeActivity('2024-01-06', true),
      makeActivity('2024-01-07', true),
      makeActivity('2024-01-08', true),
      makeActivity('2024-01-09', true),
      makeActivity('2024-01-10', true),
    ]
    const result = computeStreak(activities, '2024-01-10')
    expect(result.current).toBe(5)
    expect(result.longest).toBe(5)
    expect(result.todayMet).toBe(true)
  })

  test('5 days then 1 gap then 3 days → current=3, longest=5', () => {
    const activities = [
      makeActivity('2024-01-01', true),
      makeActivity('2024-01-02', true),
      makeActivity('2024-01-03', true),
      makeActivity('2024-01-04', true),
      makeActivity('2024-01-05', true),
      makeActivity('2024-01-06', false),
      makeActivity('2024-01-07', true),
      makeActivity('2024-01-08', true),
      makeActivity('2024-01-09', true),
    ]
    const result = computeStreak(activities, '2024-01-09')
    expect(result.current).toBe(3)
    expect(result.longest).toBe(5)
  })

  test('today not met yet, yesterday met → streak stays alive (counts from yesterday)', () => {
    const activities = [
      makeActivity('2024-01-08', true),
      makeActivity('2024-01-09', true),
      makeActivity('2024-01-10', false),
    ]
    const result = computeStreak(activities, '2024-01-10')
    expect(result.current).toBe(2)
    expect(result.todayMet).toBe(false)
    expect(result.yesterdayMet).toBe(true)
  })

  test('today and yesterday both not met → current=0', () => {
    const activities = [
      makeActivity('2024-01-07', true),
      makeActivity('2024-01-08', false),
      makeActivity('2024-01-09', false),
      makeActivity('2024-01-10', false),
    ]
    const result = computeStreak(activities, '2024-01-10')
    expect(result.current).toBe(0)
    expect(result.yesterdayMet).toBe(false)
  })

  test('only today met → current=1', () => {
    const activities = [
      makeActivity('2024-01-10', true),
    ]
    const result = computeStreak(activities, '2024-01-10')
    expect(result.current).toBe(1)
    expect(result.longest).toBe(1)
  })

  test('out of order activities → correct streak computed', () => {
    const activities = [
      makeActivity('2024-01-10', true),
      makeActivity('2024-01-08', true),
      makeActivity('2024-01-09', true),
    ]
    const result = computeStreak(activities, '2024-01-10')
    expect(result.current).toBe(3)
    expect(result.longest).toBe(3)
  })

  test('longest is correctly tracked across multiple runs', () => {
    const activities = [
      makeActivity('2024-01-01', true),
      makeActivity('2024-01-02', true),
      makeActivity('2024-01-03', true),
      makeActivity('2024-01-04', false),
      makeActivity('2024-01-05', true),
      makeActivity('2024-01-06', true),
    ]
    const result = computeStreak(activities, '2024-01-06')
    expect(result.current).toBe(2)
    expect(result.longest).toBe(3)
  })

  test('todayMet and yesterdayMet flags are correct', () => {
    const activities = [
      makeActivity('2024-01-09', true),
      makeActivity('2024-01-10', true),
    ]
    const result = computeStreak(activities, '2024-01-10')
    expect(result.todayMet).toBe(true)
    expect(result.yesterdayMet).toBe(true)
  })
})
