import AsyncStorage from '@react-native-async-storage/async-storage'
import { callLLM } from './ai/llmClient'
import type { SavedWord } from './data'

const PROMPT_CACHE_PREFIX = 'reverse_quiz_prompts_v1:'

export interface ReverseQuizPrompt {
  tr_sentence: string
  focus: string
}

export interface ReverseQuizEvaluation {
  scores: {
    semantic: number
    grammar: number
    word_usage: number
  }
  total: number
  feedback_tr: string
  suggested_translations: string[]
  highlighted_errors: Array<{ text: string; issue: string }>
}

function hashText(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

function promptCacheKey(userId: string, word: string) {
  return `${PROMPT_CACHE_PREFIX}${userId}:${word.toLowerCase()}`
}

function fallbackPrompts(word: SavedWord): ReverseQuizPrompt[] {
  const tr = word.translation || 'anlam'
  return [
    {
      tr_sentence: `"${tr}" fikri bu cümlede doğal bir şekilde geçmeli.`,
      focus: `${word.word} kelimesini kullanarak kısa ama tam bir İngilizce cümle yaz.`,
    },
    {
      tr_sentence: `Bu cümlede "${word.word}" kelimesini doğru bağlamda kullan: Dün onun ${tr} gerçekten dikkat çekiciydi.`,
      focus: 'Anlamı koru, hedef kelimeyi doğal kullan.',
    },
    {
      tr_sentence: `Şu fikri İngilizceye çevir: Bu olay bana ${tr} duygusunu yeniden hatırlattı.`,
      focus: 'Hedef kelime zorunlu, gramer temiz olsun.',
    },
  ]
}

export async function getReverseQuizPrompts(params: {
  word: SavedWord
  userId: string
  isPro?: boolean
}): Promise<ReverseQuizPrompt[]> {
  const key = promptCacheKey(params.userId, params.word.word)
  try {
    const existing = await AsyncStorage.getItem(key)
    if (existing) {
      const parsed = JSON.parse(existing)
      if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 5)
    }
  } catch {
    // ignore
  }

  let prompts = fallbackPrompts(params.word)
  try {
    const response = await callLLM({
      feature: 'reverse_quiz',
      userId: params.userId,
      isPro: params.isPro,
      model: 'gpt-4o-mini',
      cacheKey: `reverse-quiz-prompts:${hashText(`${params.word.word}:${params.word.translation || ''}:${params.word.context_sentence || ''}`)}`,
      cacheTTL: 60 * 60 * 24 * 30,
      maxRetries: 1,
      messages: [
        {
          role: 'system',
          content:
            'Türkçe→İngilizce çeviri alıştırması için 3 kısa Türkçe cümle üret. Hedef İngilizce kelime zorunlu kullanılacak. Sadece JSON dön: {"prompts":[{"tr_sentence":"...","focus":"..."}]}',
        },
        {
          role: 'user',
          content: [
            `Target word: ${params.word.word}`,
            `Translation: ${params.word.translation || 'unknown'}`,
            `Context: ${params.word.context_sentence || params.word.context || ''}`,
          ].join('\n'),
        },
      ],
    })
    const parsed = JSON.parse(response.content)
    if (Array.isArray(parsed?.prompts) && parsed.prompts.length) {
      prompts = parsed.prompts
        .map((item: any) => ({
          tr_sentence: String(item?.tr_sentence || '').trim(),
          focus: String(item?.focus || '').trim(),
        }))
        .filter((item: ReverseQuizPrompt) => item.tr_sentence)
        .slice(0, 5)
    }
  } catch {
    // fallback
  }

  await AsyncStorage.setItem(key, JSON.stringify(prompts))
  return prompts
}

export async function evaluateReverseQuizAnswer(params: {
  prompt: ReverseQuizPrompt
  word: SavedWord
  answer: string
  userId: string
  isPro?: boolean
}): Promise<ReverseQuizEvaluation> {
  const answer = params.answer.trim()
  const targetWord = params.word.word
  if (answer.split(/\s+/).filter(Boolean).length < 3) {
    return {
      scores: { semantic: 6, grammar: 4, word_usage: 0 },
      total: 10,
      feedback_tr: 'Cevap çok kısa kaldı. Tam bir İngilizce cümle yaz ve hedef kelimeyi doğal biçimde kullan.',
      suggested_translations: [],
      highlighted_errors: [{ text: answer || 'Kısa cevap', issue: 'Daha tam bir cümle gerekli.' }],
    }
  }

  try {
    const response = await callLLM({
      feature: 'reverse_quiz',
      userId: params.userId,
      isPro: params.isPro,
      model: 'gpt-4o-mini',
      maxRetries: 1,
      messages: [
        {
          role: 'system',
          content:
            'You are an English teacher evaluating a translation from Turkish to English. Return strict JSON with scores, total, feedback_tr, suggested_translations, highlighted_errors.',
        },
        {
          role: 'user',
          content: [
            `Turkish source: "${params.prompt.tr_sentence}"`,
            `Target vocabulary word that must be used: "${targetWord}"`,
            `Student's translation: "${answer}"`,
            'Evaluate semantic accuracy 0-40, grammar 0-30, target word usage 0-30.',
          ].join('\n'),
        },
      ],
    })
    const parsed = JSON.parse(response.content)
    if (parsed?.scores && typeof parsed?.total === 'number') {
      return {
        scores: {
          semantic: Number(parsed.scores.semantic || 0),
          grammar: Number(parsed.scores.grammar || 0),
          word_usage: Number(parsed.scores.word_usage || 0),
        },
        total: Number(parsed.total || 0),
        feedback_tr: String(parsed.feedback_tr || ''),
        suggested_translations: Array.isArray(parsed.suggested_translations)
          ? parsed.suggested_translations.map((item: any) => String(item)).slice(0, 2)
          : [],
        highlighted_errors: Array.isArray(parsed.highlighted_errors)
          ? parsed.highlighted_errors
              .map((item: any) => ({
                text: String(item?.text || '').trim(),
                issue: String(item?.issue || '').trim(),
              }))
              .filter((item: { text: string; issue: string }) => item.text || item.issue)
              .slice(0, 3)
          : [],
      }
    }
  } catch {
    // heuristic fallback
  }

  const usedTarget = answer.toLowerCase().includes(targetWord.toLowerCase())
  const semantic = Math.min(40, Math.max(18, Math.round(answer.split(/\s+/).filter(Boolean).length * 2.5)))
  const grammar = /[.!?]$/.test(answer) ? 24 : 18
  const wordUsage = usedTarget ? 24 : 0
  return {
    scores: { semantic, grammar, word_usage: wordUsage },
    total: semantic + grammar + wordUsage,
    feedback_tr: usedTarget
      ? 'Cümle genel olarak anlaşılır. Şimdi akıcılığı ve daha doğal ifade seçimini biraz daha güçlendirebilirsin.'
      : `Hedef kelimeyi (${targetWord}) kullanmadığın için puanın düştü. Aynı anlamı bu kelimeyle tekrar kurmayı dene.`,
    suggested_translations: usedTarget ? [] : [`Try again using "${targetWord}" in a full sentence.`],
    highlighted_errors: usedTarget ? [] : [{ text: targetWord, issue: 'Hedef kelime cümlede görünmüyor.' }],
  }
}
