import { Platform } from 'react-native'

export function speak(text: string, options?: { rate?: number; language?: string }) {
  const rate = options?.rate ?? 0.82
  const language = options?.language ?? 'en-US'

  if (Platform.OS === 'web') {
    try {
      const synth = (window as any).speechSynthesis
      if (!synth) return
      synth.cancel()
      const utt = new (window as any).SpeechSynthesisUtterance(text)
      utt.rate = rate
      utt.lang = language
      utt.pitch = 1.0
      // Pick an English voice if available
      const voices: SpeechSynthesisVoice[] = synth.getVoices?.() ?? []
      const enVoice = voices.find(
        (v: SpeechSynthesisVoice) => v.lang.startsWith('en') && v.localService
      ) || voices.find((v: SpeechSynthesisVoice) => v.lang.startsWith('en'))
      if (enVoice) utt.voice = enVoice
      synth.speak(utt)
    } catch (e) {
      console.warn('[speech] Web Speech API error:', e)
    }
  } else {
    import('expo-speech').then((Speech) => {
      Speech.speak(text, { language, rate })
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
