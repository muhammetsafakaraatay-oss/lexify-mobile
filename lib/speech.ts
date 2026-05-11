import { Platform } from 'react-native'

let _voicesReady = false
let _pendingUtterance: any = null

function getEnglishVoice(): SpeechSynthesisVoice | null {
  const synth = (window as any).speechSynthesis
  if (!synth) return null
  const voices: SpeechSynthesisVoice[] = synth.getVoices?.() ?? []
  // Prefer local (on-device) English voices, fall back to remote
  return (
    voices.find((v) => v.lang === 'en-US' && v.localService) ||
    voices.find((v) => v.lang.startsWith('en-GB') && v.localService) ||
    voices.find((v) => v.lang.startsWith('en') && v.localService) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null
  )
}

function speakNow(text: string, rate: number) {
  const synth = (window as any).speechSynthesis
  if (!synth) return

  // Stop any ongoing speech first
  synth.cancel()

  // Chrome bug: must defer speak() after cancel() with a small timeout
  setTimeout(() => {
    const utt = new (window as any).SpeechSynthesisUtterance(text)
    utt.lang = 'en-US'
    utt.rate = rate
    utt.pitch = 1.0
    utt.volume = 1.0

    const voice = getEnglishVoice()
    if (voice) utt.voice = voice

    utt.onerror = (e: any) => {
      // Swallow 'interrupted' errors — they're expected when cancel() is called
      if (e.error !== 'interrupted') {
        console.warn('[speech] utterance error:', e.error)
      }
    }

    synth.speak(utt)
  }, 50)
}

export function speak(text: string, options?: { rate?: number; language?: string }) {
  const rate = options?.rate ?? 0.85

  if (Platform.OS === 'web') {
    try {
      const synth = (window as any).speechSynthesis
      if (!synth) return

      const voices: SpeechSynthesisVoice[] = synth.getVoices?.() ?? []

      if (voices.length > 0) {
        // Voices already loaded — speak immediately
        speakNow(text, rate)
      } else {
        // Voices not yet loaded — wait for voiceschanged then speak
        const handler = () => {
          synth.removeEventListener?.('voiceschanged', handler)
          speakNow(text, rate)
        }
        synth.addEventListener?.('voiceschanged', handler)

        // Fallback: some browsers never fire voiceschanged — try after 300ms anyway
        setTimeout(() => {
          synth.removeEventListener?.('voiceschanged', handler)
          speakNow(text, rate)
        }, 300)
      }
    } catch (e) {
      console.warn('[speech] Web Speech API error:', e)
    }
  } else {
    import('expo-speech').then((Speech) => {
      Speech.speak(text, { language: options?.language ?? 'en-US', rate })
    }).catch((e) => console.warn('[speech] expo-speech error:', e))
  }
}

export function cancelSpeech() {
  if (Platform.OS === 'web') {
    try {
      (window as any).speechSynthesis?.cancel()
    } catch {}
  } else {
    import('expo-speech').then((Speech) => Speech.stop?.()).catch(() => {})
  }
}
