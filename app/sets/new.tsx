import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { listSavedWords, type SavedWord } from '../../lib/data'
import { createSet } from '../../lib/sets'

export default function NewSetScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')
  const [savedWords, setSavedWords] = useState<SavedWord[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    listSavedWords()
      .then((rows) => alive && setSavedWords(rows))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return savedWords
    return savedWords.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        (w.translation || '').toLowerCase().includes(q),
    )
  }, [savedWords, search])

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setPicked(new Set(filtered.map((w) => w.id)))
  }
  function clearAll() {
    setPicked(new Set())
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Set adı gerekli', 'Lütfen sete bir ad ver.')
      return
    }
    if (picked.size === 0) {
      Alert.alert('Terim seç', 'En az bir kelime seçmelisin.')
      return
    }
    setSaving(true)
    try {
      const created = await createSet({
        name: name.trim(),
        description: description.trim() || undefined,
        termIds: Array.from(picked),
      })
      router.replace(`/sets/${created.id}`)
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Set kaydedilemedi')
      setSaving(false)
    }
  }

  function renderRow({ item }: { item: SavedWord }) {
    const checked = picked.has(item.id)
    return (
      <TouchableOpacity
        style={[styles.row, checked && styles.rowChecked]}
        activeOpacity={0.85}
        onPress={() => toggle(item.id)}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked ? <Ionicons name="checkmark" size={14} color={colors.bg} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowWord}>{item.word}</Text>
          {item.translation ? (
            <Text style={styles.rowTr} numberOfLines={1}>{item.translation}</Text>
          ) : null}
        </View>
        {item.cefr ? (
          <View style={styles.cefrPill}>
            <Text style={styles.cefrPillText}>{item.cefr}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Yeni Set</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (saving || picked.size === 0 || !name.trim()) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || picked.size === 0 || !name.trim()}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <Text style={styles.saveBtnText}>Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>SET ADI</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="ör. İş İngilizcesi · Hafta 1"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={60}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>AÇIKLAMA (opsiyonel)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Setin kapsamı / konusu"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { minHeight: 44 }]}
          maxLength={140}
          multiline
        />
      </View>

      <View style={styles.pickerHeader}>
        <Text style={styles.label}>TERİMLER ({picked.size} seçili)</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.linkBtn}>Tümünü seç</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.linkBtn}>Temizle</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Kelime ara..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : savedWords.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Kayıtlı kelimen yok</Text>
          <Text style={styles.emptyDesc}>
            Önce "Oku" veya "Sözlük" üzerinden kelime kaydet, sonra setlere ekle.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(w) => w.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 6 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 12,
  },
  topTitle: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800', marginLeft: 6 },
  saveBtn: {
    backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, minWidth: 76, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.bg, fontWeight: '800', fontSize: 13 },

  fieldBlock: { paddingHorizontal: 20, marginBottom: 10 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    color: colors.text, fontSize: 15,
  },
  linkBtn: { color: colors.accent, fontSize: 12, fontWeight: '700' },

  pickerHeader: {
    paddingHorizontal: 20, marginTop: 6, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  searchBox: {
    marginHorizontal: 20, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgCard, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, padding: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  rowChecked: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  rowWord: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowTr: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  cefrPill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  cefrPillText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  emptyDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
})
