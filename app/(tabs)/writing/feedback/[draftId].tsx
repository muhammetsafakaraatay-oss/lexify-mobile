// Lexify · Writing — Free heuristic feedback screen.
// On-device IELTS-style analysis of a completed (or draft) writing.

import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../../lib/theme'
import { getWritingTask, WritingTask } from '../../../../lib/writing'
import {
  analyzeWriting,
  WritingAnalysis,
  CriterionScore,
} from '../../../../lib/writingAnalyzer'
import {
  analyzeWritingWithAI,
  readAICache,
  clearAICache,
  AIWritingFeedback,
  getWritingAIErrorMeta,
} from '../../../../lib/writingAi'

type Phase = 'loading' | 'ready' | 'error' | 'empty'
type AIPhase = 'idle' | 'cached' | 'loading' | 'ready' | 'error'

function bandColor(score: number): string {
  if (score >= 7.5) return '#4ade80'
  if (score >= 6.5) return '#a3e635'
  if (score >= 5.5) return '#facc15'
  if (score >= 4.5) return '#fb923c'
  return '#f87171'
}

export default function WritingFeedbackScreen() {
  const router = useRouter()
  const { draftId } = useLocalSearchParams<{ draftId: string }>()

  const [phase, setPhase] = useState<Phase>('loading')
  const [task, setTask] = useState<WritingTask | null>(null)
  const [errMsg, setErrMsg] = useState('')

  // AI deep analysis state
  const [aiPhase, setAiPhase] = useState<AIPhase>('idle')
  const [aiFb, setAiFb] = useState<AIWritingFeedback | null>(null)
  const [aiErr, setAiErr] = useState('')
  const [aiErrTitle, setAiErrTitle] = useState('AI cevap veremedi')
  const [showAISetupHint, setShowAISetupHint] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const id = typeof draftId === 'string' ? draftId : ''
        if (!id) throw new Error('Geçersiz taslak.')
        const row = await getWritingTask(id)
        if (cancelled) return
        if (!row) {
          setErrMsg('Taslak bulunamadı.')
          setPhase('error')
          return
        }
        if (!row.content || !row.content.trim()) {
          setTask(row)
          setPhase('empty')
          return
        }
        setTask(row)
        setPhase('ready')

        // Try to load any previously cached AI result
        try {
          const cached = await readAICache(row.id, row.content.trim())
          if (!cancelled && cached) {
            setAiFb(cached)
            setAiPhase('cached')
          }
        } catch {
          // ignore cache miss
        }
      } catch (e: any) {
        if (cancelled) return
        setErrMsg(e?.message || 'Yükleme başarısız.')
        setPhase('error')
      }
    })()
    return () => { cancelled = true }
  }, [draftId])

  const runAIAnalysis = async (forceRefresh = false) => {
    if (!task) return
    setAiErr('')
    setAiErrTitle('AI cevap veremedi')
    setShowAISetupHint(false)
    setAiPhase('loading')
    try {
      const fb = await analyzeWritingWithAI(task, { forceRefresh })
      setAiFb(fb)
      setAiPhase('ready')
    } catch (e: any) {
      const meta = getWritingAIErrorMeta(e)
      setAiErrTitle(meta.title)
      setAiErr(meta.message)
      setShowAISetupHint(Boolean(__DEV__ && meta.showSetupHint))
      setAiPhase('error')
    }
  }

  const clearAIResult = async () => {
    if (!task) return
    try {
      await clearAICache(task.id, (task.content ?? '').trim())
    } catch {
      // ignore
    }
    setAiFb(null)
    setAiPhase('idle')
    setAiErr('')
  }

  const analysis: WritingAnalysis | null = useMemo(() => {
    if (!task || !task.content) return null
    return analyzeWriting(task.content, task.target_words || 250)
  }, [task])

  // ─── States ────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={44} color="#f87171" />
          <Text style={styles.errTitle}>Açılamadı</Text>
          <Text style={styles.errText}>{errMsg}</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (phase === 'empty' || !analysis || !task) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="document-outline" size={44} color={colors.textMuted} />
          <Text style={styles.errTitle}>İçerik yok</Text>
          <Text style={styles.errText}>
            Bu taslakta henüz analiz edilecek metin yok. Editöre dönüp yazı yazmalısın.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace(`/(tabs)/writing/${task?.id ?? ''}` as any)}
          >
            <Text style={styles.primaryBtnText}>Editöre dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ─── Ready ─────────────────────────────────────────────────────────────
  const a = analysis
  return (
    <SafeAreaView style={styles.container}>
      <Header onBack={() => router.back()} title="Geri Bildirim" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Free disclaimer */}
        <View style={styles.freePill}>
          <Ionicons name="sparkles" size={11} color={colors.bg} />
          <Text style={styles.freePillText}>ÜCRETSİZ · cihazda çalışır</Text>
        </View>

        {/* Band hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>TAHMİNİ IELTS BAND</Text>
          <Text style={[styles.heroScore, { color: bandColor(a.bandScore) }]}>
            {a.bandScore.toFixed(1)}
          </Text>
          <Text style={styles.heroLabel}>{a.bandLabel}</Text>
          <Text style={styles.heroNote}>
            Bu tahmin, kural tabanlı heuristic analize dayanır. Resmi puan değildir
            ama eksiklerini görmen için iyi bir başlangıçtır.
          </Text>
        </View>

        {/* Per-criterion scores */}
        <Text style={styles.sectionLabel}>KRİTER PUANLARI</Text>
        <View style={styles.criteriaGrid}>
          <CritCell
            icon="checkmark-done-outline"
            title="Task Response"
            sub="Soruya cevap, uzunluk, yapı"
            cs={a.scores.taskResponse}
          />
          <CritCell
            icon="link-outline"
            title="Coherence"
            sub="Bağlaçlar, akış, paragraf"
            cs={a.scores.coherence}
          />
          <CritCell
            icon="book-outline"
            title="Lexical"
            sub="Kelime çeşitliliği, akademik"
            cs={a.scores.lexical}
          />
          <CritCell
            icon="construct-outline"
            title="Grammar"
            sub="Cümle yapısı, hatalar"
            cs={a.scores.grammar}
          />
        </View>

        {/* Quick metrics */}
        <Text style={styles.sectionLabel}>METRİKLER</Text>
        <View style={styles.metricsGrid}>
          <Metric label="Kelime"        value={`${a.metrics.words}/${task.target_words}`} />
          <Metric label="Cümle"         value={String(a.metrics.sentences)} />
          <Metric label="Paragraf"      value={String(a.metrics.paragraphs)} />
          <Metric label="Çeşitlilik"    value={`${(a.metrics.typeTokenRatio * 100).toFixed(0)}%`} hint="unique / total" />
          <Metric label="Ort. cümle"    value={`${a.metrics.avgSentenceLength.toFixed(1)}`} hint="kelime" />
          <Metric label="Karmaşık cml." value={`${(a.metrics.complexSentenceRatio * 100).toFixed(0)}%`} />
          <Metric label="Bağlaç"        value={`${a.metrics.linkerCount} (${a.metrics.uniqueLinkers}×)`} hint={`${a.metrics.linkerDensity.toFixed(1)}/100`} />
          <Metric label="Uzun kelime"   value={`${(a.metrics.longWordPct * 100).toFixed(0)}%`} hint="≥ 8 harf" />
        </View>

        {/* Positives */}
        {a.positives.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>İYİ YAPTIKLARIN</Text>
            <View style={styles.bulletList}>
              {a.positives.map((p, i) => (
                <BulletRow key={i} icon="checkmark-circle" color="#4ade80" text={p} />
              ))}
            </View>
          </>
        )}

        {/* Improvements */}
        {a.improvements.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>GELİŞTİRİLEBİLİR</Text>
            <View style={styles.bulletList}>
              {a.improvements.map((p, i) => (
                <BulletRow key={i} icon="arrow-up-circle" color="#facc15" text={p} />
              ))}
            </View>
          </>
        )}

        {/* Errors */}
        {a.errors.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>OLASI HATALAR</Text>
            <View style={styles.errList}>
              {a.errors.map((e, i) => (
                <View key={i} style={styles.errCard}>
                  <View style={styles.errHead}>
                    <Ionicons name="alert-circle" size={14} color="#f87171" />
                    <Text style={styles.errType}>{e.message}</Text>
                  </View>
                  <Text style={styles.errSnippet}>"{e.snippet}"</Text>
                  {e.suggestion && (
                    <Text style={styles.errSugg}>Öneri: {e.suggestion}</Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ─── AI deep analysis (opt-in) ─── */}
        <View style={styles.aiBlock}>
          <View style={styles.aiHeadRow}>
            <View style={styles.aiBadge}>
              <Ionicons name="flash" size={11} color={colors.accent} />
              <Text style={styles.aiBadgeText}>AI · DERİN ANALİZ</Text>
            </View>
            {aiPhase === 'ready' || aiPhase === 'cached' ? (
              <TouchableOpacity onPress={clearAIResult} hitSlop={8}>
                <Text style={styles.aiClearText}>Temizle</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {aiPhase === 'idle' && (
            <>
              <Text style={styles.aiPitchTitle}>Daha derin geri bildirim ister misin?</Text>
              <Text style={styles.aiPitchText}>
                Yapay zeka kalemini IELTS examiner gibi okur: gerçek band tahmini,
                örnek düzeltilmiş paragraf, kelime ve gramer önerileri.
              </Text>
              <TouchableOpacity
                style={styles.aiPrimaryBtn}
                onPress={() => runAIAnalysis(false)}
              >
                <Ionicons name="sparkles" size={14} color={colors.bg} />
                <Text style={styles.aiPrimaryBtnText}>AI ile analiz et</Text>
              </TouchableOpacity>
              <Text style={styles.aiHelper}>
                Gemini Flash ile ücretsiz · sonuç 30 gün cihazda saklanır.
              </Text>
            </>
          )}

          {aiPhase === 'loading' && (
            <View style={styles.aiLoadingBox}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.aiLoadingText}>AI cevabını hazırlıyor...</Text>
              <Text style={styles.aiHelper}>Bu işlem 5-15 saniye sürebilir.</Text>
            </View>
          )}

          {aiPhase === 'error' && (
            <View style={styles.aiErrBox}>
              <Ionicons name="cloud-offline-outline" size={22} color="#f87171" />
              <Text style={styles.aiErrTitle}>{aiErrTitle}</Text>
              <Text style={styles.aiErrText}>{aiErr}</Text>
              <TouchableOpacity
                style={styles.aiSecondaryBtn}
                onPress={() => runAIAnalysis(true)}
              >
                <Ionicons name="refresh" size={14} color={colors.text} />
                <Text style={styles.aiSecondaryBtnText}>Tekrar dene</Text>
              </TouchableOpacity>
              {showAISetupHint ? (
                <Text style={styles.aiHelper}>
                  .env dosyana EXPO_PUBLIC_GEMINI_API_KEY ekledin mi?
                  aistudio.google.com/apikey'den ücretsiz al, sonra Expo dev sunucusunu yeniden başlat.
                </Text>
              ) : (
                <Text style={styles.aiHelper}>
                  Temel geri bildirim yukarıda çalışmaya devam eder; bu bölüm yalnızca ek AI önerileri içindir.
                </Text>
              )}
            </View>
          )}

          {(aiPhase === 'ready' || aiPhase === 'cached') && aiFb && (
            <>
              {aiPhase === 'cached' && (
                <Text style={styles.aiCachedNote}>
                  ⓘ Bu sonuç önbellekten alındı.
                </Text>
              )}

              {/* AI band hero */}
              <View style={styles.aiHero}>
                <Text style={styles.aiHeroEyebrow}>AI BAND TAHMİNİ</Text>
                <Text style={[styles.aiHeroScore, { color: bandColor(aiFb.overall) }]}>
                  {aiFb.overall.toFixed(1)}
                </Text>
                {aiFb.summary ? (
                  <Text style={styles.aiHeroSummary}>{aiFb.summary}</Text>
                ) : null}
              </View>

              {/* AI per-criterion */}
              <View style={styles.aiCritGrid}>
                <AiCrit label="Task Response" score={aiFb.scores.task_response} />
                <AiCrit label="Coherence" score={aiFb.scores.coherence} />
                <AiCrit label="Lexical" score={aiFb.scores.lexical} />
                <AiCrit label="Grammar" score={aiFb.scores.grammar} />
              </View>

              {/* AI strengths */}
              {aiFb.strengths.length > 0 && (
                <>
                  <Text style={styles.aiSubLabel}>AI · GÜÇLÜ YÖNLERİN</Text>
                  <View style={styles.bulletList}>
                    {aiFb.strengths.map((s, i) => (
                      <BulletRow key={i} icon="checkmark-circle" color="#4ade80" text={s} />
                    ))}
                  </View>
                </>
              )}

              {/* AI improvements */}
              {aiFb.improvements.length > 0 && (
                <>
                  <Text style={styles.aiSubLabel}>AI · GELİŞTİRME ÖNERİLERİ</Text>
                  <View style={styles.bulletList}>
                    {aiFb.improvements.map((s, i) => (
                      <BulletRow key={i} icon="arrow-up-circle" color="#facc15" text={s} />
                    ))}
                  </View>
                </>
              )}

              {/* AI errors with corrections */}
              {aiFb.errors.length > 0 && (
                <>
                  <Text style={styles.aiSubLabel}>AI · CÜMLE DÜZELTMELERİ</Text>
                  <View style={styles.errList}>
                    {aiFb.errors.map((e, i) => (
                      <View key={i} style={styles.errCard}>
                        <View style={styles.errHead}>
                          <View style={styles.aiCatPill}>
                            <Text style={styles.aiCatPillText}>{e.category}</Text>
                          </View>
                        </View>
                        <Text style={styles.aiOrig}>✗ {e.original}</Text>
                        <Text style={styles.aiCorr}>✓ {e.corrected}</Text>
                        {e.explanation ? (
                          <Text style={styles.errSugg}>{e.explanation}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Model paragraph */}
              {aiFb.model_paragraph ? (
                <>
                  <Text style={styles.aiSubLabel}>AI · ÖRNEK İYİLEŞTİRİLMİŞ PARAGRAF</Text>
                  <View style={styles.aiModelBox}>
                    <Text style={styles.aiModelText}>{aiFb.model_paragraph}</Text>
                  </View>
                </>
              ) : null}

              <TouchableOpacity
                style={styles.aiRefreshBtn}
                onPress={() => runAIAnalysis(true)}
              >
                <Ionicons name="refresh" size={13} color={colors.textMuted} />
                <Text style={styles.aiRefreshText}>Yeniden analiz et</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Top repeated */}
        {a.topRepeated.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>EN ÇOK TEKRAR ETTİĞİN</Text>
            <View style={styles.chipRow}>
              {a.topRepeated.map((r) => (
                <View key={r.word} style={styles.repChip}>
                  <Text style={styles.repChipWord}>{r.word}</Text>
                  <Text style={styles.repChipCount}>{r.count}×</Text>
                </View>
              ))}
            </View>
            <Text style={styles.helperText}>
              Aynı kelimeleri çok tekrar ediyorsan, eş anlamlılar veya
              farklı ifadelerle dene — lexical puanın yükselir.
            </Text>
          </>
        )}

        {/* Footer actions */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace(`/(tabs)/writing/${task.id}` as any)}
          >
            <Ionicons name="create-outline" size={16} color={colors.text} />
            <Text style={styles.secondaryBtnText}>Editöre dön</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtnRow}
            onPress={() => router.replace('/(tabs)/writing' as any)}
          >
            <Ionicons name="list-outline" size={16} color={colors.bg} />
            <Text style={styles.primaryBtnText}>Tüm yazılarım</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          ⓘ Bu skorlama heuristic'tir ve resmi IELTS değerlendirmesi değildir.
          Cevabın kalitesi, içerik derinliği ve özgünlük tek başına metrikle ölçülemez.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Components ────────────────────────────────────────────────────────────

function Header({ onBack, title = 'Writing' }: { onBack: () => void; title?: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.headerBack}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
  )
}

function CritCell({ icon, title, sub, cs }: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  sub: string
  cs: CriterionScore
}) {
  const color = bandColor(cs.score)
  return (
    <View style={styles.critCell}>
      <View style={styles.critHead}>
        <Ionicons name={icon} size={14} color={colors.accent} />
        <Text style={styles.critTitle}>{title}</Text>
      </View>
      <Text style={styles.critSub}>{sub}</Text>
      <View style={styles.critScoreRow}>
        <Text style={[styles.critScore, { color }]}>{cs.score.toFixed(1)}</Text>
        <View style={[styles.critPill, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.critPillText, { color }]}>{cs.label}</Text>
        </View>
      </View>
      <View style={styles.critBar}>
        <View style={[styles.critBarFill, { width: `${(cs.score / 9) * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {hint && <Text style={styles.metricHint}>{hint}</Text>}
    </View>
  )
}

function BulletRow({ icon, color, text }: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  text: string
}) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons name={icon} size={16} color={color} style={{ marginTop: 1 }} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

function AiCrit({ label, score }: { label: string; score: number }) {
  const color = bandColor(score)
  return (
    <View style={styles.aiCritCell}>
      <Text style={styles.aiCritLabel}>{label}</Text>
      <Text style={[styles.aiCritScore, { color }]}>{score.toFixed(1)}</Text>
      <View style={styles.aiCritBar}>
        <View
          style={[
            styles.aiCritBarFill,
            { width: `${(score / 9) * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

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
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },

  content: { padding: 16, paddingBottom: 40, gap: 4 },

  freePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    marginBottom: 8,
  },
  freePillText: { color: colors.bg, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },

  heroCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    padding: 18, gap: 4, alignItems: 'center',
    marginBottom: 14,
  },
  heroEyebrow: {
    color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1,
  },
  heroScore: {
    fontSize: 52, fontWeight: '900', lineHeight: 60,
    fontVariant: ['tabular-nums'], marginTop: 2,
  },
  heroLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  heroNote: {
    color: colors.textMuted, fontSize: 11, lineHeight: 16,
    textAlign: 'center', marginTop: 6,
  },

  sectionLabel: {
    color: colors.textDim, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.1, marginTop: 12, marginBottom: 8,
  },

  // Criteria grid
  criteriaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  critCell: {
    width: '48%', flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 10, gap: 4,
  },
  critHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  critTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  critSub: { color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  critScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  critScore: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  critPill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
    borderWidth: 1,
  },
  critPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  critBar: {
    height: 4, backgroundColor: colors.bg, borderRadius: 2,
    overflow: 'hidden', marginTop: 6,
  },
  critBarFill: { height: 4, borderRadius: 2 },

  // Metrics grid
  metricsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  metricBox: {
    width: '23.5%', flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 8, alignItems: 'center', gap: 1,
    minWidth: 76,
  },
  metricValue: {
    color: colors.text, fontSize: 14, fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  metricHint: { color: colors.textDim, fontSize: 9 },

  // Bullets
  bulletList: { gap: 6 },
  bulletRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 10,
  },
  bulletText: { color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 },

  // Errors
  errList: { gap: 6 },
  errCard: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: '#3a1f1f',
    borderRadius: 10, padding: 10, gap: 4,
  },
  errHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errType: { color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 },
  errSnippet: { color: '#fda4af', fontSize: 12, fontStyle: 'italic' },
  errSugg: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },

  // Repeated chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  repChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
  },
  repChipWord: { color: colors.text, fontSize: 12, fontWeight: '700' },
  repChipCount: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  helperText: {
    color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6,
  },

  // Footer
  footerRow: {
    flexDirection: 'row', gap: 8, marginTop: 18,
  },
  primaryBtnRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent, paddingVertical: 12, borderRadius: 999,
  },
  primaryBtn: {
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
  },
  primaryBtnText: { color: colors.bg, fontWeight: '900', fontSize: 13 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '900', fontSize: 13 },

  disclaimer: {
    color: colors.textDim, fontSize: 10, lineHeight: 14,
    textAlign: 'center', marginTop: 16,
  },

  errTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  errText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4, marginBottom: 14 },

  // ── AI block ──
  aiBlock: {
    marginTop: 22,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    padding: 14, gap: 8,
  },
  aiHeadRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1a1500', borderColor: colors.accent, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    alignSelf: 'flex-start',
  },
  aiBadgeText: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  aiClearText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },

  aiPitchTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  aiPitchText: {
    color: colors.textMuted, fontSize: 12, lineHeight: 18,
  },
  aiPrimaryBtn: {
    marginTop: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent, paddingVertical: 11, borderRadius: 999,
  },
  aiPrimaryBtnText: { color: colors.bg, fontWeight: '900', fontSize: 13 },
  aiSecondaryBtn: {
    marginTop: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border,
    alignSelf: 'center',
  },
  aiSecondaryBtnText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  aiHelper: {
    color: colors.textDim, fontSize: 10, lineHeight: 14,
    textAlign: 'center', marginTop: 6,
  },

  aiLoadingBox: { alignItems: 'center', paddingVertical: 14, gap: 6 },
  aiLoadingText: { color: colors.text, fontSize: 13, fontWeight: '700' },

  aiErrBox: { alignItems: 'center', gap: 4, paddingVertical: 10 },
  aiErrTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 4 },
  aiErrText: {
    color: colors.textMuted, fontSize: 12, lineHeight: 17,
    textAlign: 'center', paddingHorizontal: 8,
  },

  aiCachedNote: {
    color: colors.textDim, fontSize: 10, fontStyle: 'italic',
  },

  aiHero: {
    backgroundColor: colors.bg, borderRadius: 12, padding: 14,
    alignItems: 'center', gap: 2, marginTop: 4,
  },
  aiHeroEyebrow: {
    color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1,
  },
  aiHeroScore: {
    fontSize: 38, fontWeight: '900', lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  aiHeroSummary: {
    color: colors.text, fontSize: 12, lineHeight: 17,
    textAlign: 'center', marginTop: 4,
  },

  aiCritGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4,
  },
  aiCritCell: {
    width: '48%', flexGrow: 1,
    backgroundColor: colors.bg, borderRadius: 10,
    padding: 10, gap: 2,
  },
  aiCritLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  aiCritScore: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  aiCritBar: {
    height: 3, backgroundColor: colors.border, borderRadius: 2,
    overflow: 'hidden', marginTop: 4,
  },
  aiCritBarFill: { height: 3, borderRadius: 2 },

  aiSubLabel: {
    color: colors.textDim, fontSize: 10, fontWeight: '800',
    letterSpacing: 1, marginTop: 10, marginBottom: 4,
  },

  aiCatPill: {
    backgroundColor: '#2a1a05', borderWidth: 1, borderColor: '#5a3a10',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
    alignSelf: 'flex-start',
  },
  aiCatPillText: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  aiOrig: { color: '#fda4af', fontSize: 12, lineHeight: 17 },
  aiCorr: { color: '#86efac', fontSize: 12, lineHeight: 17, fontWeight: '600' },

  aiModelBox: {
    backgroundColor: colors.bg, borderRadius: 10,
    borderLeftWidth: 3, borderLeftColor: colors.accent,
    padding: 10,
  },
  aiModelText: { color: colors.text, fontSize: 12.5, lineHeight: 19, fontStyle: 'italic' },

  aiRefreshBtn: {
    marginTop: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8,
  },
  aiRefreshText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
})
