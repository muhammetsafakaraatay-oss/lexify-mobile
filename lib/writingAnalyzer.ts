// Lexify · Writing analyzer
// Pure heuristic IELTS-style feedback engine. Runs entirely on-device, no
// network, no API cost. It does not claim to replace a human examiner; it
// gives the learner fast, useful guidance based on rubric-aligned metrics.
//
// Returns a `WritingAnalysis` shaped to the IELTS Writing rubric:
//   • Task Response       — coverage, target length, paragraphing
//   • Coherence & Cohesion — linker density, paragraph structure, sentence variety
//   • Lexical Resource    — vocab diversity, long words, repetition
//   • Grammatical Range   — sentence complexity, length variation, common errors
//
// Each criterion is scored 0–9 (IELTS band scale). The overall band is the
// weighted average rounded to the nearest 0.5.

export type CriterionScore = {
  score: number   // 0–9, rounded to 0.5
  label: string   // Turkish short summary, e.g. "İyi"
}

export type AnalysisError = {
  type: string
  message: string       // Turkish
  snippet: string       // The offending text
  suggestion?: string   // Turkish improvement hint
}

export type WritingMetrics = {
  words: number
  uniqueWords: number
  typeTokenRatio: number      // unique / total
  sentences: number
  avgSentenceLength: number
  paragraphs: number
  avgWordLength: number
  longWordPct: number         // words with ≥ 8 chars / total
  linkerCount: number
  linkerDensity: number       // per 100 words
  uniqueLinkers: number
  complexSentenceRatio: number // sentences containing a subordinator
}

export type WritingAnalysis = {
  bandScore: number
  bandLabel: string
  scores: {
    taskResponse: CriterionScore
    coherence: CriterionScore
    lexical: CriterionScore
    grammar: CriterionScore
  }
  metrics: WritingMetrics
  positives: string[]
  improvements: string[]
  errors: AnalysisError[]
  topRepeated: Array<{ word: string; count: number }>
  meetsTarget: boolean
  comparedToTarget: number   // words / target
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference lists
// ─────────────────────────────────────────────────────────────────────────────

// Common IELTS / academic linking words. Multi-word phrases are checked as
// substrings (lowercased text). The single-word entries are matched against
// tokens directly.
const LINKER_WORDS = new Set([
  'however','moreover','furthermore','therefore','thus','hence','consequently',
  'although','though','whereas','while','despite','meanwhile','similarly',
  'firstly','secondly','thirdly','finally','additionally','besides',
  'nevertheless','nonetheless','accordingly','indeed','overall',
])

const LINKER_PHRASES = [
  'in addition', 'in conclusion', 'in summary', 'in contrast',
  'on the other hand', 'on the one hand', 'as a result', 'for example',
  'for instance', 'such as', 'to sum up', 'in my opinion', 'in my view',
  'it can be argued', 'it is clear', 'it is true that', 'first of all',
  'to begin with', 'last but not least', 'in particular',
]

const SUBORDINATORS = new Set([
  'because','although','though','since','if','unless','until','while',
  'whereas','whenever','wherever','before','after','when','as','that',
  'which','who','whom','whose','where','why','how',
])

// Words we ignore for the "most-repeated" report (function / stop words).
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','so','of','to','for','in','on','at',
  'by','with','from','as','is','am','are','was','were','be','been','being',
  'do','does','did','have','has','had','will','would','can','could',
  'should','may','might','must','shall','it','its','this','that','these',
  'those','i','me','my','mine','we','our','ours','you','your','yours',
  'he','him','his','she','her','hers','they','them','their','theirs',
  'not','no','yes','if','than','then','there','here','what','which','who',
  'when','where','why','how','about','into','out','up','down','over','under',
  'too','also','very','just','also','only','any','some','all','more','most',
  'much','many','few','one','two','three','first','last','same','other',
  'don','doesn','didn','won','wouldn','isn','wasn','aren','weren','haven',
  'hasn','hadn','couldn','shouldn','mustn',
])

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function bandLabel(score: number): string {
  if (score >= 8.5) return 'Mükemmel'
  if (score >= 7.5) return 'Çok iyi'
  if (score >= 6.5) return 'İyi'
  if (score >= 5.5) return 'Orta'
  if (score >= 4.5) return 'Geliştirilebilir'
  return 'Temel'
}

function roundToHalf(x: number): number {
  return Math.max(0, Math.min(9, Math.round(x * 2) / 2))
}

function tokenizeWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z][a-z'-]*/g)
  return matches ?? []
}

function splitSentences(text: string): string[] {
  // Conservative sentence splitter: split on . ! ? followed by space + capital
  // or end of string. Good enough for IELTS-style prose.
  const trimmed = text.trim()
  if (!trimmed) return []
  return trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])|(?<=[.!?])\s*\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-criterion scoring (0–9)
// ─────────────────────────────────────────────────────────────────────────────

function scoreTaskResponse(metrics: WritingMetrics, targetWords: number): CriterionScore {
  const wordRatio = targetWords > 0 ? metrics.words / targetWords : 1
  // Word coverage: full credit at 100%+, scaled below.
  let s = 4 + Math.min(1, wordRatio) * 4 // 4.0 ... 8.0
  if (wordRatio >= 1) s = 7.5
  if (wordRatio >= 1.1 && metrics.paragraphs >= 3) s = 8.0
  if (wordRatio >= 1.1 && metrics.paragraphs >= 4) s = 8.5
  if (wordRatio < 0.6) s -= 1.5
  if (wordRatio < 0.4) s -= 1.0
  if (metrics.paragraphs <= 1 && metrics.words > 80) s -= 1.0
  return { score: roundToHalf(s), label: bandLabel(s) }
}

function scoreCoherence(metrics: WritingMetrics): CriterionScore {
  // Target linker density ≈ 3–6 per 100 words. Diminishing returns above 8.
  const d = metrics.linkerDensity
  let densityScore = 0
  if (d >= 3 && d <= 6) densityScore = 8
  else if (d > 6 && d <= 8) densityScore = 7.5
  else if (d > 8) densityScore = 6.5  // too many linkers feels mechanical
  else if (d >= 2) densityScore = 7
  else if (d >= 1) densityScore = 5.5
  else densityScore = 4.5

  const varietyBonus = Math.min(1.0, metrics.uniqueLinkers * 0.15)
  const paragraphBonus =
    metrics.paragraphs >= 4 ? 0.5 :
    metrics.paragraphs >= 3 ? 0.25 :
    metrics.paragraphs <= 1 && metrics.words > 80 ? -1.0 : 0

  const s = densityScore + varietyBonus + paragraphBonus
  return { score: roundToHalf(s), label: bandLabel(s) }
}

function scoreLexical(metrics: WritingMetrics, repeatedRatio: number): CriterionScore {
  // Type-token ratio target: 0.45–0.65 for IELTS-length essays.
  const ttr = metrics.typeTokenRatio
  let ttrScore = 0
  if (ttr >= 0.55) ttrScore = 8
  else if (ttr >= 0.48) ttrScore = 7
  else if (ttr >= 0.40) ttrScore = 6
  else if (ttr >= 0.32) ttrScore = 5
  else ttrScore = 4

  // Lexical sophistication via long-word percentage (8+ chars).
  // Academic prose typically has 12–18% long words.
  const lw = metrics.longWordPct
  let lwScore = 0
  if (lw >= 0.14) lwScore = 8
  else if (lw >= 0.10) lwScore = 7
  else if (lw >= 0.07) lwScore = 6
  else if (lw >= 0.04) lwScore = 5
  else lwScore = 4

  // Penalty for heavy repetition.
  const repPenalty = repeatedRatio > 0.12 ? -1.0 : repeatedRatio > 0.08 ? -0.5 : 0

  const s = (ttrScore + lwScore) / 2 + repPenalty
  return { score: roundToHalf(s), label: bandLabel(s) }
}

function scoreGrammar(metrics: WritingMetrics, errorCount: number): CriterionScore {
  // Sentence variation: avg length 12–20 words, complex ratio ≥ 30%.
  const a = metrics.avgSentenceLength
  let lenScore = 0
  if (a >= 12 && a <= 22) lenScore = 8
  else if (a >= 9 && a < 12) lenScore = 6.5
  else if (a > 22 && a <= 30) lenScore = 7
  else if (a > 30) lenScore = 5.5
  else if (a >= 6) lenScore = 5
  else lenScore = 4

  const c = metrics.complexSentenceRatio
  let complexScore = 0
  if (c >= 0.45) complexScore = 8.5
  else if (c >= 0.30) complexScore = 7.5
  else if (c >= 0.20) complexScore = 6.5
  else if (c >= 0.10) complexScore = 5.5
  else complexScore = 4.5

  const errorPenalty = Math.min(2, errorCount * 0.3)
  const s = (lenScore + complexScore) / 2 - errorPenalty
  return { score: roundToHalf(s), label: bandLabel(s) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule-based error detection
// ─────────────────────────────────────────────────────────────────────────────

function detectErrors(text: string): AnalysisError[] {
  const errors: AnalysisError[] = []
  const seen = new Set<string>()

  const push = (e: AnalysisError) => {
    const key = `${e.type}::${e.snippet}`
    if (seen.has(key)) return
    seen.add(key)
    errors.push(e)
  }

  // 1. lowercase "i" pronoun
  const iMatches = text.match(/(^|[^a-zA-Z'])i([^a-zA-Z'])/g)
  if (iMatches && iMatches.length > 0) {
    for (let i = 0; i < Math.min(3, iMatches.length); i++) {
      push({
        type: 'pronoun_case',
        message: "İngilizce'de \"I\" (ben) zamiri her zaman büyük yazılır.",
        snippet: iMatches[i].trim(),
        suggestion: '"I" olarak büyük yaz.',
      })
    }
  }

  // 2. Double article / double word
  const dupRe = /\b(the|a|an|is|are|was|were|of|to)\s+\1\b/gi
  let m: RegExpExecArray | null
  while ((m = dupRe.exec(text)) !== null) {
    push({
      type: 'duplicate_word',
      message: 'Aynı kelime arka arkaya tekrar etmiş.',
      snippet: m[0],
      suggestion: 'Bir tanesini sil.',
    })
  }

  // 3. "a" before vowel sound (basic heuristic — won't catch all edge cases)
  const aVowel = text.match(/\ba\s+[aeiouAEIOU]\w+/g)
  if (aVowel) {
    for (let i = 0; i < Math.min(3, aVowel.length); i++) {
      push({
        type: 'article_an',
        message: 'Sesli harfle başlayan kelimeden önce "a" yerine "an" gelir.',
        snippet: aVowel[i],
        suggestion: `"${aVowel[i].replace(/^a/, 'an')}" olarak değiştir.`,
      })
    }
  }

  // 4. Sentence not capitalized
  const sentences = splitSentences(text)
  for (const s of sentences) {
    if (s.length > 0 && /^[a-z]/.test(s)) {
      push({
        type: 'capitalization',
        message: 'Cümleler büyük harfle başlamalı.',
        snippet: s.slice(0, 40) + (s.length > 40 ? '...' : ''),
        suggestion: 'İlk harfi büyüt.',
      })
      break // single example is enough
    }
  }

  // 5. Comma splice heuristic: ", " followed by lowercase 3+ word clause
  // We approximate by counting cases of ", " not preceded by linker words and
  // followed by a subject-like pattern. Too brittle to be precise; only flag
  // very obvious cases.
  const commaSplice = text.match(/,\s+(it|he|she|we|they|i)\s+(is|are|was|were|will|would|can|could|do|does|did|have|has)\b/gi)
  if (commaSplice && commaSplice.length >= 2) {
    push({
      type: 'comma_splice',
      message: 'Bağımsız iki cümleyi sadece virgülle birleştirmek (comma splice) yaygın bir hatadır.',
      snippet: commaSplice[0].trim(),
      suggestion: 'Yerine "; " kullan veya "and / but" gibi bağlaç ekle.',
    })
  }

  // 6. Sentence-ending punctuation missing on final fragment
  const lastChar = text.trim().slice(-1)
  if (text.trim().length > 40 && !/[.!?"']/.test(lastChar)) {
    push({
      type: 'final_punct',
      message: 'Yazının son cümlesi noktalama ile bitmiyor.',
      snippet: text.trim().slice(-40),
      suggestion: 'Nokta ekle.',
    })
  }

  // 7. Very long sentence (run-on candidate)
  for (const s of sentences) {
    const wc = (s.match(/[a-zA-Z][a-zA-Z'-]*/g) ?? []).length
    if (wc > 45) {
      push({
        type: 'long_sentence',
        message: 'Çok uzun bir cümle — netlik için bölünebilir.',
        snippet: s.slice(0, 60) + '...',
        suggestion: 'İki ayrı cümleye bölmeyi düşün.',
      })
      break
    }
  }

  return errors
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeWriting(text: string, targetWords: number): WritingAnalysis {
  const lower = text.toLowerCase()
  const words = tokenizeWords(text)
  const sentences = splitSentences(text)
  const paragraphs = splitParagraphs(text)

  // Vocabulary
  const wordCount = words.length
  const wordSet = new Set(words)
  const uniqueWords = wordSet.size
  const typeTokenRatio = wordCount > 0 ? uniqueWords / wordCount : 0

  // Word length
  const totalLen = words.reduce((sum, w) => sum + w.length, 0)
  const avgWordLength = wordCount > 0 ? totalLen / wordCount : 0
  const longWords = words.filter((w) => w.length >= 8).length
  const longWordPct = wordCount > 0 ? longWords / wordCount : 0

  // Linkers
  let linkerCount = 0
  const uniqueLinkerSet = new Set<string>()
  for (const w of words) {
    if (LINKER_WORDS.has(w)) {
      linkerCount++
      uniqueLinkerSet.add(w)
    }
  }
  for (const p of LINKER_PHRASES) {
    const re = new RegExp(`\\b${p}\\b`, 'gi')
    const matches = lower.match(re)
    if (matches) {
      linkerCount += matches.length
      uniqueLinkerSet.add(p)
    }
  }
  const linkerDensity = wordCount > 0 ? (linkerCount / wordCount) * 100 : 0

  // Complex sentences (contains a subordinator)
  let complex = 0
  for (const s of sentences) {
    const sw = s.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []
    if (sw.some((w) => SUBORDINATORS.has(w))) complex++
  }
  const complexSentenceRatio = sentences.length > 0 ? complex / sentences.length : 0

  // Avg sentence length
  const avgSentenceLength =
    sentences.length > 0
      ? sentences.reduce((sum, s) => sum + ((s.match(/[a-zA-Z][a-zA-Z'-]*/g) ?? []).length), 0) /
        sentences.length
      : 0

  // Top repeated content words
  const freq = new Map<string, number>()
  for (const w of words) {
    if (w.length <= 2) continue
    if (STOP_WORDS.has(w)) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  const topRepeated = Array.from(freq.entries())
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word, count]) => ({ word, count }))
  const repeatedTokens = topRepeated.reduce((sum, e) => sum + e.count, 0)
  const repeatedRatio = wordCount > 0 ? repeatedTokens / wordCount : 0

  const metrics: WritingMetrics = {
    words: wordCount,
    uniqueWords,
    typeTokenRatio,
    sentences: sentences.length,
    avgSentenceLength,
    paragraphs: paragraphs.length,
    avgWordLength,
    longWordPct,
    linkerCount,
    linkerDensity,
    uniqueLinkers: uniqueLinkerSet.size,
    complexSentenceRatio,
  }

  const errors = detectErrors(text)

  const taskResponse = scoreTaskResponse(metrics, targetWords)
  const coherence = scoreCoherence(metrics)
  const lexical = scoreLexical(metrics, repeatedRatio)
  const grammar = scoreGrammar(metrics, errors.length)

  // Weighted overall (IELTS criteria are equally weighted in official scoring).
  const overall =
    (taskResponse.score + coherence.score + lexical.score + grammar.score) / 4
  const bandScore = roundToHalf(overall)

  // Positives + improvements
  const positives: string[] = []
  const improvements: string[] = []

  if (metrics.words >= targetWords) {
    positives.push(`Hedef kelime sayısına ulaştın (${metrics.words} / ${targetWords}).`)
  } else {
    improvements.push(
      `Hedefin altındasın: ${metrics.words} kelime, hedef ${targetWords}. En az ${targetWords - metrics.words} kelime daha ekle.`,
    )
  }
  if (metrics.paragraphs >= 4) {
    positives.push(`Paragraf yapın sağlam (${metrics.paragraphs} paragraf).`)
  } else if (metrics.paragraphs <= 1 && metrics.words > 80) {
    improvements.push('Yazıyı en az 3-4 paragrafa böl: giriş, 2 gelişme, sonuç.')
  } else if (metrics.paragraphs === 2 && metrics.words > 150) {
    improvements.push('Bir paragraf daha ekle (ideal: giriş + 2 gelişme + sonuç).')
  }
  if (metrics.linkerDensity >= 3 && metrics.uniqueLinkers >= 4) {
    positives.push(`Bağlaç kullanımın iyi (${metrics.linkerCount} bağlaç, ${metrics.uniqueLinkers} farklı tür).`)
  } else if (metrics.linkerDensity < 2) {
    improvements.push(
      'Daha fazla bağlaç kullan: however, moreover, in addition, for example, on the other hand...',
    )
  }
  if (metrics.typeTokenRatio >= 0.5) {
    positives.push(`Kelime çeşitliliğin yüksek (TTR ${(metrics.typeTokenRatio * 100).toFixed(0)}%).`)
  } else if (metrics.typeTokenRatio < 0.4 && wordCount > 80) {
    improvements.push('Aynı kelimeleri çok tekrar ediyorsun — eş anlamlılar ve farklı yapılar dene.')
  }
  if (metrics.complexSentenceRatio >= 0.35) {
    positives.push('Karmaşık cümle yapılarını başarıyla kullanmışsın.')
  } else if (metrics.complexSentenceRatio < 0.15 && sentences.length > 4) {
    improvements.push(
      'Daha çok karmaşık cümle dene (although, because, while, which... gibi bağlaçlarla).',
    )
  }
  if (metrics.longWordPct < 0.07 && wordCount > 80) {
    improvements.push('Daha akademik / uzun kelimeler dene (significant, consequence, demonstrate...).')
  }
  if (errors.length === 0) {
    positives.push('Temel dilbilgisi hatası tespit edilmedi.')
  } else {
    improvements.push(`${errors.length} olası küçük hata aşağıda işaretli — gözden geçir.`)
  }

  return {
    bandScore,
    bandLabel: bandLabel(bandScore),
    scores: { taskResponse, coherence, lexical, grammar },
    metrics,
    positives,
    improvements,
    errors,
    topRepeated,
    meetsTarget: metrics.words >= targetWords,
    comparedToTarget: targetWords > 0 ? metrics.words / targetWords : 0,
  }
}
