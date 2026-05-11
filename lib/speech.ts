import { Platform } from 'react-native'

let _currentAudio: HTMLAudioElement | null = null

export function speak(text: string, options?: { rate?: number; language?: string }) {
  const lang = options?.language ?? 'en-US'

  if (Platform.OS === 'web') {
    try {
      // Stop any currently playing audio
      if (_currentAudio) {
        _currentAudio.pause()
        _currentAudio.currentTime = 0
        _currentAudio = null
      }

      // Use proxy TTS endpoint — Google Translate pronunciation audio
      const url = `/tts?text=${encodeURIComponent(text)}&lang=${lang}`
      const audio = new Audio(url)
      _currentAudio = audio

      audio.onerror = () => {
        // Fallback to Web Speech API if proxy TTS fails
        _webSpeechFallback(text, lang, options?.rate ?? 0.85)
      }

      audio.play().catch(() => {
        _webSpeechFallback(text, lang, options?.rate ?? 0.85)
      })
    } catch (e) {
      console.warn('[speech] error:', e)
    }
  } else {
    import('expo-speech').then((Speech) => {
      Speech.speak(text, { language: lang, rate: options?.rate ?? 0.85 })
    }).catch((e) => console.warn('[speech] expo-speech error:', e))
  }
}

function _webSpeechFallback(text: string, lang: string, rate: number) {
  try {
    const synth = (window as any).speechSynthesis
    if (!synth) return
    synth.cancel()
    setTimeout(() => {
      const utt = new (window as any).SpeechSynthesisUtterance(text)
      utt.lang = lang
      utt.rate = rate
      utt.pitch = 1.0
      utt.volume = 1.0
      const voices: SpeechSynthesisVoice[] = synth.getVoices?.() ?? []
      const voice =
        voices.find((v) => v.lang === 'en-US' && v.localService) ||
        voices.find((v) => v.lang.startsWith('en') && v.localService) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        null
      if (voice) utt.voice = voice
      synth.speak(utt)
    }, 50)
  } catch {}
}

export function cancelSpeech() {
  if (Platform.OS === 'web') {
    try {
      if (_currentAudio) {
        _currentAudio.pause()
        _currentAudio.currentTime = 0
        _currentAudio = null
      }
      ;(window as any).speechSynthesis?.cancel()
    } catch {}
  } else {
    import('expo-speech').then((Speech) => Speech.stop?.()).catch(() => {})
  }
}
