import { useCallback, useRef } from 'react'
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native'

const LONG_PRESS_MS = 480

interface TouchableWordProps {
  children: string
  onPress: () => void
  onLongPress: () => void
  style?: StyleProp<TextStyle>
}

/**
 * Inline kelime dokunma alanı.
 * Web'de Text.onLongPress güvenilir değil; native'de de aynı timer kullanılır.
 */
export function TouchableWord({ children, onPress, onLongPress, style }: TouchableWordProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startLongPressTimer = useCallback(() => {
    clearTimer()
    didLongPressRef.current = false
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }, [clearTimer, onLongPress])

  const finishPointer = useCallback(() => {
    clearTimer()
    if (!didLongPressRef.current) {
      onPress()
    }
    didLongPressRef.current = false
  }, [clearTimer, onPress])

  const handleNativePress = useCallback(() => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false
      return
    }
    onPress()
  }, [onPress])

  const handleNativeLongPress = useCallback(() => {
    didLongPressRef.current = true
    onLongPress()
  }, [onLongPress])

  if (Platform.OS === 'web') {
    return (
      <Text
        selectable={false}
        suppressHighlighting
        style={style}
        // @ts-expect-error — RN Web pointer events
        onPointerDown={(e: { button?: number }) => {
          if (typeof e.button === 'number' && e.button !== 0) return
          startLongPressTimer()
        }}
        onPointerUp={finishPointer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
      >
        {children}
      </Text>
    )
  }

  return (
    <Text
      selectable={false}
      suppressHighlighting
      style={style}
      onPress={handleNativePress}
      onLongPress={handleNativeLongPress}
    >
      {children}
    </Text>
  )
}
