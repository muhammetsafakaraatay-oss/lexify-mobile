import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'
import { getRecentActivity, computeStreak } from './streak'
import { getPreferences } from './preferences'

const CHANNEL_ID = 'lexify-daily'
const REMINDER_ID = 'lexify-daily-reminder'

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[notifications] Push notifications only work on physical devices.')
    return null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Günlük Hatırlatma',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#facc15',
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Push permission not granted.')
    return null
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync()
    return tokenData.data
  } catch (e) {
    console.error('[notifications] getExpoPushTokenAsync error:', e)
    return null
  }
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  await cancelDailyReminder()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const today = new Date().toISOString().split('T')[0]
  const activities = await getRecentActivity(30)
  const prefs = await getPreferences()
  const streakInfo = computeStreak(activities, today)

  let title = 'Lexify — Öğrenmeye devam et!'
  let body = 'Bugünkü kelimeleri çalışmak için 10 dakikan var.'

  const dueCount = 0

  if (streakInfo.todayMet) {
    return
  } else if (dueCount > 0) {
    title = `🔥 ${streakInfo.current} günlük serin devam ediyor!`
    body = `Bugün gözden geçirilecek ${dueCount} kelime var — seriyi koru!`
  } else {
    title = '📚 Lexify seni bekliyor'
    body = '10 dakikalık çalışma bugünün hedefini bitirir.'
  }

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title,
      body,
      sound: true,
      data: { type: 'daily-reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  })
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID)
  } catch {
  }
}

export async function refreshScheduledReminders(): Promise<void> {
  const prefs = await getPreferences()
  if (!prefs?.reminderEnabled || prefs.reminderHour == null || prefs.reminderMinute == null) {
    await cancelDailyReminder()
    return
  }
  await scheduleDailyReminder(prefs.reminderHour, prefs.reminderMinute)
}
