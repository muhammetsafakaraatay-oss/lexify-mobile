import type { ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'

export function StudyAmbient() {
  return (
    <>
      <View style={[styles.glow, styles.glowAccent]} />
      <View style={[styles.glow, styles.glowBlue]} />
    </>
  )
}

interface StudyTopBarProps {
  title: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
}

export function StudyTopBar({ title, subtitle, onBack, right }: StudyTopBarProps) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backPlaceholder} />
      )}
      <View style={styles.topCenter}>
        <Text style={styles.topEyebrow}>LEXIFY</Text>
        <Text style={styles.topTitle}>{title}</Text>
        {subtitle ? <Text style={styles.topSub}>{subtitle}</Text> : null}
      </View>
      <View style={styles.topRight}>{right ?? <View style={styles.backPlaceholder} />}</View>
    </View>
  )
}

interface StudyProgressProps {
  current: number
  total: number
  label?: string
}

export function StudyProgress({ current, total, label }: StudyProgressProps) {
  const pct = total > 0 ? Math.min(1, current / total) : 0
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressMeta}>
        <Text style={styles.progressLabel}>{label ?? 'İlerleme'}</Text>
        <Text style={styles.progressCount}>
          <Text style={styles.progressCurrent}>{current}</Text>
          <Text style={styles.progressSep}> / </Text>
          {total}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  )
}

interface StatChipProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  tint?: string
}

export function StatChip({ icon, label, value, tint = colors.accent }: StatChipProps) {
  return (
    <View style={styles.chip}>
      <View style={[styles.chipIcon, { backgroundColor: tint + '18' }]}>
        <Ionicons name={icon} size={14} color={tint} />
      </View>
      <View>
        <Text style={styles.chipLabel}>{label}</Text>
        <Text style={[styles.chipValue, { color: tint }]}>{value}</Text>
      </View>
    </View>
  )
}

interface SessionCompleteProps {
  icon: keyof typeof Ionicons.glyphMap
  iconColor?: string
  title: string
  subtitle: string
  stats: { label: string; value: string; color?: string }[]
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  children?: ReactNode
}

export function SessionComplete({
  icon,
  iconColor = colors.accent,
  title,
  subtitle,
  stats,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  children,
}: SessionCompleteProps) {
  return (
    <View style={styles.completeWrap}>
      <View style={[styles.completeIconRing, { borderColor: iconColor + '40' }]}>
        <View style={[styles.completeIconInner, { backgroundColor: iconColor + '14' }]}>
          <Ionicons name={icon} size={40} color={iconColor} />
        </View>
      </View>
      <Text style={styles.completeTitle}>{title}</Text>
      <Text style={styles.completeSub}>{subtitle}</Text>

      {stats.length > 0 ? (
        <View style={styles.completeStats}>
          {stats.map((s, i) => (
            <View key={s.label} style={styles.completeStatRow}>
              {i > 0 ? <View style={styles.completeStatDivider} /> : null}
              <View style={styles.completeStatCell}>
                <Text style={[styles.completeStatVal, s.color ? { color: s.color } : null]}>{s.value}</Text>
                <Text style={styles.completeStatLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {children}

      <TouchableOpacity style={styles.primaryBtn} onPress={onPrimary} activeOpacity={0.88}>
        <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.bg} />
      </TouchableOpacity>

      {secondaryLabel && onSecondary ? (
        <TouchableOpacity style={styles.secondaryBtn} onPress={onSecondary} activeOpacity={0.88}>
          <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

interface StudyEmptyProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  text: string
  actionLabel?: string
  onAction?: () => void
}

export function StudyEmpty({ icon, title, text, actionLabel, onAction }: StudyEmptyProps) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={36} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={onAction} activeOpacity={0.88}>
          <Text style={styles.primaryBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

/** Kart arkası dekoratif katman */
export function CardStackShadow() {
  return (
    <>
      <View style={[styles.stackCard, styles.stackCard2]} />
      <View style={[styles.stackCard, styles.stackCard1]} />
    </>
  )
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.35,
  },
  glowAccent: {
    top: -80,
    right: -60,
    backgroundColor: 'rgba(250,204,21,0.22)',
  },
  glowBlue: {
    top: 120,
    left: -100,
    backgroundColor: 'rgba(96,165,250,0.12)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: { width: 40 },
  topCenter: { flex: 1, paddingTop: 2 },
  topRight: { width: 40, alignItems: 'flex-end' },
  topEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 2,
  },
  topTitle: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  topSub: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  progressBlock: { paddingHorizontal: 20, marginBottom: 12 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  progressCount: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  progressCurrent: { color: colors.accent, fontWeight: '800' },
  progressSep: { color: colors.textDim, fontWeight: '600' },
  progressTrack: {
    height: 6,
    backgroundColor: '#141414',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { color: colors.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  chipValue: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 1 },
  completeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    paddingTop: 48,
  },
  completeIconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  completeIconInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  completeSub: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 300,
  },
  completeStats: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeStatRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  completeStatCell: { flex: 1, alignItems: 'center' },
  completeStatVal: { fontSize: 26, fontWeight: '800', color: colors.text },
  completeStatLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  completeStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 320,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24, maxWidth: 280 },
  stackCard: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#1c1c1c',
  },
  stackCard1: { transform: [{ scale: 0.97 }, { translateY: 8 }], opacity: 0.5 },
  stackCard2: { transform: [{ scale: 0.94 }, { translateY: 16 }], opacity: 0.25 },
})
