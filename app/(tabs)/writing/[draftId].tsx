// Lexify · Writing — Editor
//
// One row from writing_tasks. Shows the snapshot prompt at the top,
// a live word counter + timer (counts up; turns yellow once you pass the
// suggested minutes), a multi-line content TextInput, and three actions:
//   - Otomatik kaydet (debounced background save while typing)
//   - "Taslağı kaydet" (immediate, stays as draft)
//   - "Bitti / Tamamlandı" (sets status = completed)

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, AppState,
  AppStateStatus,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import {
  getWritingTask,
  updateWritingTask,
  deleteWritingTask,
  WritingTask,
} from '../../../lib/writing'
import {
  PROMPT_TYPE_LABELS,
  PROMPT_CATEGORY_LABELS,
  countWords,
} from '../../../lib/writingPrompts'

type Phase = 'loading' | 'error' | 'ready'

function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
    globalThis.alert(`${title}\n\n${message}`)
    return
  }
  Alert.alert(title, message)
}

function confirmMessage(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
    return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`))
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Tamam', style: 'default', onPress: () => resolve(true) },
    ])
  })
}

export default function WritingEditorScreen() {
  const router = useRouter()
  const { draftId } = useLocalSearchParams<{ draftId: string }>()
  const idRef = useRef<string>(typeof draftId === 'string' ? draftId : '')

  const [phase, setPhase] = useState<Phase>('loading')
  const [errMsg, setErrMsg] = useState('')
  const [task, setTask] = useState<WritingTask | null>(null)

  // Local editor state — keeps the text input snappy without round-tripping.
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [showPromptFull, setShowPromptFull] = useState(true)

  // Refs to avoid stale state in async callbacks / intervals.
  const titleRef = useRef('')
  const contentRef = useRef('')
  const elapsedRef = useRef(0)
  const dirtyRef = useRef(false)
  const taskRef = useRef<WritingTask | null>(null)
  const pausedRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  titleRef.current = title
  contentRef.current = content
  elapsedRef.current = elapsed
  taskRef.current = task

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const id = idRef.current
        if (!id) throw new Error('Geçersiz taslak.')
        const row = await getWritingTask(id)
        if (cancelled) return
        if (!row) {
          setErrMsg('Taslak bulunamadı.')
          setPhase('error')
          return
        }
        setTask(row)
        setTitle(row.title || '')
        setContent(row.content || '')
        setElapsed(row.duration_seconds || 0)
        setPhase('ready')
      } catch (e: any) {
        if (cancelled) return
        setErrMsg(e?.message || 'Yükleme başarısız.')
        setPhase('error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return
    // Stop counting once the task is completed (we still allow edits).
    const t = setInterval(() => {
      if (pausedRef.current) return
      if (taskRef.current?.status === 'completed') return
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  // Pause when app goes to background.
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      pausedRef.current = state !== 'active'
    }
    const sub = AppState.addEventListener('change', handler)
    return () => sub.remove()
  }, [])

  // ── Auto-save (debounced 1.5s after last change) ────────────────────────
  const scheduleAutosave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      void flushSave({ silent: true, status: undefined })
    }, 1500)
  }, [])

  const flushSave = useCallback(
    async (opts: { silent?: boolean; status?: 'draft' | 'completed' } = {}) => {
      const id = idRef.current
      if (!id || !taskRef.current) return
      if (!dirtyRef.current && !opts.status) return

      const prevTask = taskRef.current
      const patch = {
        title: titleRef.current,
        content: contentRef.current,
        duration_seconds: Math.max(0, Math.round(elapsedRef.current)),
        ...(opts.status ? { status: opts.status as 'draft' | 'completed' } : {}),
      }

      if (!opts.silent) setSaving(true)
      try {
        if (opts.status) {
          const optimistic: WritingTask = {
            ...prevTask,
            ...patch,
            word_count:
              typeof patch.content === 'string' ? countWords(patch.content) : prevTask.word_count,
            updated_at: new Date().toISOString(),
          }
          setTask(optimistic)
          taskRef.current = optimistic
        }
        const next = await updateWritingTask(id, patch)
        setTask(next)
        taskRef.current = next
        dirtyRef.current = false
        setSavedAt(Date.now())
        if (!opts.silent && opts.status === 'completed') {
          showMessage('Tamamlandı', 'Yazı tamamlandı olarak işaretlendi.')
        }
      } catch (e: any) {
        if (opts.status) {
          setTask(prevTask)
          taskRef.current = prevTask
        }
        if (!opts.silent) {
          showMessage('Kaydedilemedi', e?.message || 'Bilinmeyen hata.')
        }
      } finally {
        if (!opts.silent) setSaving(false)
      }
    },
    [],
  )

  // Flush on unmount.
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      // Fire-and-forget; don't block unmount.
      if (dirtyRef.current) void flushSave({ silent: true })
    }
  }, [flushSave])

  const onChangeTitle = (v: string) => {
    setTitle(v)
    dirtyRef.current = true
    scheduleAutosave()
  }
  const onChangeContent = (v: string) => {
    setContent(v)
    dirtyRef.current = true
    scheduleAutosave()
  }

  const handleSaveDraft = () => {
    void flushSave({ status: 'draft' })
  }

  const handleComplete = useCallback(async () => {
    const ok = await confirmMessage(
      'Yazıyı tamamla',
      'Yazıyı tamamlandı olarak işaretlemek istiyor musun? Sonradan tekrar açıp düzenleyebilirsin.',
    )
    if (!ok) return
    await flushSave({ status: 'completed' })
  }, [flushSave])

  const handleDelete = useCallback(async () => {
    const ok = await confirmMessage(
      'Taslağı sil?',
      'Bu yazıyı silmek istediğinden emin misin?',
    )
    if (!ok) return
    try {
      await deleteWritingTask(idRef.current)
      router.back()
    } catch (e: any) {
      showMessage('Hata', e?.message || 'Silinemedi.')
    }
  }, [router])

  // ── Derived numbers ────────────────────────────────────────────────────
  const wordCount = useMemo(() => countWords(content), [content])
  const targetWords = task?.target_words ?? 250
  const targetMinutes = task?.suggested_minutes ?? 40
  const pct = targetWords > 0 ? Math.min(1.2, wordCount / targetWords) : 0
  const isOverTime = task ? elapsed > targetMinutes * 60 : false
  const wcColor = wordCount >= targetWords ? '#4ade80'
    : wordCount >= targetWords * 0.7 ? colors.accent
    : colors.text
  const timerColor = isOverTime ? '#f87171' : colors.accent

  // ── Render ─────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'error' || !task) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={44} color="#f87171" />
          <Text style={styles.errTitle}>Açılamadı</Text>
          <Text style={styles.errText}>{errMsg}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const typeShort = PROMPT_TYPE_LABELS[task.prompt_type]?.short ?? task.prompt_type
  const category = PROMPT_CATEGORY_LABELS[task.prompt_category as keyof typeof PROMPT_CATEGORY_LABELS] || task.prompt_category
  const isCompleted = task.status === 'completed'

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{typeShort}</Text>
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>{category}</Text>
          </View>
          <TouchableOpacity onPress={handleDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        <View style={styles.statsBar}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>SÜRE</Text>
            <Text style={[styles.statValue, { color: timerColor }]}>
              {fmtClock(elapsed)}
            </Text>
            <Text style={styles.statHint}>/ {targetMinutes} dk</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>KELİME</Text>
            <Text style={[styles.statValue, { color: wcColor }]}>
              {wordCount}
            </Text>
            <Text style={styles.statHint}>/ {targetWords}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>DURUM</Text>
            <Text style={[styles.statValue, { color: isCompleted ? '#4ade80' : colors.text, fontSize: 14 }]}>
              {isCompleted ? 'Tamam' : 'Taslak'}
            </Text>
            <Text style={styles.statHint}>
              {savedAt ? `kayıt: ${fmtClock(Math.floor((Date.now() - savedAt) / 1000))} önce` : 'kaydedilmedi'}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressOuter}>
          <View
            style={[
              styles.progressInner,
              {
                width: `${Math.min(100, pct * 100)}%`,
                backgroundColor: wordCount >= targetWords ? '#4ade80' : colors.accent,
              },
            ]}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Prompt card */}
          <View style={styles.promptCard}>
            <View style={styles.promptHeader}>
              <Ionicons name="reader-outline" size={14} color={colors.accent} />
              <Text style={styles.promptHeaderText}>PROMPT</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setShowPromptFull((v) => !v)} hitSlop={8}>
                <Text style={styles.promptToggle}>
                  {showPromptFull ? 'Gizle' : 'Göster'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.promptTitle}>{task.prompt_title}</Text>
            {showPromptFull && (
              <Text style={styles.promptBody}>{task.prompt_body}</Text>
            )}
          </View>

          {/* Title input */}
          <Text style={styles.fieldLabel}>BAŞLIK (İSTEĞE BAĞLI)</Text>
          <TextInput
            value={title}
            onChangeText={onChangeTitle}
            placeholder="Yazına bir başlık ver..."
            placeholderTextColor={colors.textDim}
            style={styles.titleInput}
            maxLength={140}
            editable={!isCompleted || true /* allow editing even after completion */}
          />

          {/* Content input */}
          <Text style={styles.fieldLabel}>YAZI</Text>
          <TextInput
            value={content}
            onChangeText={onChangeContent}
            placeholder={'Yazına burada başla...\n\nIELTS taktiği: kısa giriş + 2 gelişme paragrafı + sonuç.'}
            placeholderTextColor={colors.textDim}
            style={styles.contentInput}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
            autoCorrect
            autoCapitalize="sentences"
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={handleSaveDraft}
              style={styles.secondaryBtn}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={16} color={colors.text} />
                  <Text style={styles.secondaryBtnText}>Kaydet</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleComplete}
              style={[styles.primaryBtn, isCompleted && styles.primaryBtnDone]}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Ionicons
                name={isCompleted ? 'checkmark-circle' : 'checkmark-done'}
                size={16}
                color={colors.bg}
              />
              <Text style={styles.primaryBtnText}>
                {isCompleted ? 'Tamamlandı' : 'Tamamla'}
              </Text>
            </TouchableOpacity>
          </View>

          {content.trim().length >= 30 && (
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/writing/feedback/${idRef.current}` as any)}
              style={styles.feedbackBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="analytics-outline" size={16} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.feedbackBtnTitle}>
                  Ücretsiz Geri Bildirim Al
                </Text>
                <Text style={styles.feedbackBtnSub}>
                  IELTS kriterlerine göre tahmini band score + öneriler
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.accent} />
            </TouchableOpacity>
          )}

          <Text style={styles.autoSaveNote}>
            Yazdıkça otomatik olarak kaydediliyor.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.headerBack}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerSub}>Writing</Text>
      <View style={{ width: 22 }} />
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, gap: 8,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8,
  },
  headerBack: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  headerSub: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  typePill: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  typePillText: {
    color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.4,
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 4,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingVertical: 10,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statHint: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 6 },

  // Progress bar
  progressOuter: {
    marginHorizontal: 16, marginTop: 8,
    height: 4, backgroundColor: colors.bgCard, borderRadius: 2, overflow: 'hidden',
  },
  progressInner: { height: 4, borderRadius: 2 },

  scroll: { flex: 1, marginTop: 12 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 60 },

  promptCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 12, gap: 6, marginBottom: 14,
  },
  promptHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  promptHeaderText: {
    color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6,
  },
  promptToggle: {
    color: colors.accent, fontSize: 11, fontWeight: '800',
  },
  promptTitle: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  promptBody: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 2 },

  fieldLabel: {
    color: colors.textDim, fontSize: 10, fontWeight: '800',
    letterSpacing: 0.8, marginBottom: 6,
  },

  titleInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    color: colors.text, fontSize: 15, fontWeight: '700',
    marginBottom: 14,
  },

  contentInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    color: colors.text, fontSize: 15, lineHeight: 22,
    minHeight: 280,
    marginBottom: 14,
  },

  actionsRow: {
    flexDirection: 'row', gap: 10, marginTop: 6,
  },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent, paddingVertical: 13, borderRadius: 999,
  },
  primaryBtnDone: { backgroundColor: '#4ade80' },
  primaryBtnText: { color: colors.bg, fontWeight: '900', fontSize: 14 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '900', fontSize: 14 },

  autoSaveNote: {
    color: colors.textDim, fontSize: 11, textAlign: 'center',
    marginTop: 12,
  },
  feedbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.accentDim,
    borderWidth: 1, borderColor: 'rgba(250,204,21,0.35)',
    borderRadius: 14, padding: 12, marginTop: 14,
  },
  feedbackBtnTitle: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  feedbackBtnSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  errTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  errText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4, marginBottom: 14 },
})
