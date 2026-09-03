import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useTheme } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function WelcomeSplash({ onFinish }: { onFinish: () => void }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(reducedMotion ? 0 : 10);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: reducedMotion ? 0 : 420, easing: Easing.out(Easing.cubic) });
    opacity.value = withDelay(reducedMotion ? 250 : 1050, withTiming(0, { duration: reducedMotion ? 120 : 360 }, (done) => {
      if (done) runOnJS(onFinish)();
    }));
  }, [onFinish, opacity, reducedMotion, translateY]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.colors.background }, containerStyle]} accessibilityLabel="Bienvenida a Destellos de Hada">
      <View style={[styles.hairline, { backgroundColor: theme.colors.champagne }]} />
      <Animated.View style={[styles.content, contentStyle]}>
        <BrandLogo variant="mark" width={78} />
        <Text style={[styles.title, { color: theme.colors.primaryDark }]}>Destellos de Hada</Text>
        <Text style={[styles.subtitle, { color: theme.colors.primary }]}>JOYERÍA · COQUIMBO</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  content: { alignItems: 'center' },
  hairline: { position: 'absolute', width: 1, height: 58, top: 0 },
  title: { fontFamily: 'Georgia', fontSize: 30, lineHeight: 38, marginTop: 18, letterSpacing: -0.4 },
  subtitle: { fontSize: 9.5, fontWeight: '800', letterSpacing: 2.8, marginTop: 7 },
});
