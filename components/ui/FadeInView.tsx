import { useEffect } from 'react'
import { ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

interface FadeInViewProps {
  children: React.ReactNode
  delay?: number
  style?: ViewStyle
}

export function FadeInView({ children, delay = 0, style }: FadeInViewProps) {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(16)

  useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, { damping: 18, stiffness: 120 }))
    translateY.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 120 }))
  }, [delay, opacity, translateY])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
}
