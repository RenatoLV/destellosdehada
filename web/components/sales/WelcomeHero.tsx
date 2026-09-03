import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type Props = { onExplore?: () => void };

const HERO_IMAGE = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1400&auto=format&fit=crop&q=88';

export function WelcomeHero({ onExplore }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 720;

  if (isMobile) {
    return (
      <View style={[styles.mobileHero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.mobileImageFrame}>
          <Image
            source={{ uri: HERO_IMAGE }}
            style={styles.image}
            contentFit="cover"
            contentPosition={{ left: '64%', top: '50%' }}
            transition={250}
          />
          <View style={styles.mobileImageVeil} />
          <View style={styles.mobileEyebrow}>
            <View style={[styles.eyebrowLine, { backgroundColor: theme.colors.champagneLight }]} />
            <Text style={styles.eyebrowInverse}>COLECCIÓN 2026 · COQUIMBO</Text>
          </View>
        </View>

        <View style={styles.mobileCopyPanel}>
          <Text style={[styles.mobileTitle, { color: theme.colors.text }]}>Detalles que guardan un momento.</Text>
          <Text style={[styles.mobileSubtitle, { color: theme.colors.textSecondary }]}>
            Joyas, aromas y prendas escogidas con intención para acompañarte todos los días.
          </Text>
          <Pressable
            onPress={onExplore}
            style={({ pressed }) => [
              styles.mobileButton,
              { backgroundColor: theme.colors.primary },
              pressed && { backgroundColor: theme.colors.primaryDark },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Explorar la colección"
          >
            <Text style={styles.mobileButtonText}>Explorar colección</Text>
            <Feather name="arrow-right" size={17} color={theme.colors.textInverse} />
          </Pressable>
          <View style={[styles.mobileProof, { borderTopColor: theme.colors.border }]}>
            <Feather name="shield" size={15} color={theme.colors.primary} />
            <Text style={[styles.mobileProofText, { color: theme.colors.textSecondary }]}>Selección cuidada · Despachos a todo Chile</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primaryDark }]}>
      <Image source={{ uri: HERO_IMAGE }} style={styles.image} contentFit="cover" contentPosition="center" transition={250} />
      <View style={styles.overlay} />
      <View style={styles.content}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowLine, { backgroundColor: theme.colors.champagneLight }]} />
          <Text style={styles.eyebrowInverse}>COLECCIÓN 2026 · COQUIMBO</Text>
        </View>
        <Text style={styles.title}>Detalles que guardan{`\n`}un momento.</Text>
        <Text style={styles.subtitle}>Joyas, aromas y prendas escogidas con intención para acompañarte todos los días.</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={onExplore}
            style={({ hovered, pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.colors.primary },
              (hovered || pressed) && { backgroundColor: theme.colors.primaryLight },
            ]}
          >
            <Text style={styles.primaryButtonText}>Explorar colección</Text>
            <Feather name="arrow-right" size={16} color="#FFFDF9" />
          </Pressable>
          <View style={styles.proof}>
            <Feather name="shield" size={15} color={theme.colors.champagneLight} />
            <Text style={styles.proofText}>Selección cuidada</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 520, borderRadius: 20, overflow: 'hidden', position: 'relative', justifyContent: 'center' },
  image: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42, 12, 22, 0.62)' },
  content: { position: 'relative', maxWidth: 650, paddingHorizontal: 64, paddingVertical: 64 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  eyebrowLine: { width: 28, height: 1 },
  eyebrowInverse: { color: '#FFF7E6', fontSize: 10.5, fontWeight: '700', letterSpacing: 2.2 },
  title: { color: '#FFFDF9', fontFamily: 'Cormorant Garamond', fontSize: 60, lineHeight: 61, letterSpacing: -0.8, fontWeight: '500' },
  subtitle: { color: 'rgba(255,253,249,0.82)', fontSize: 16, lineHeight: 26, maxWidth: 480, marginTop: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 22, marginTop: 30 },
  primaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24, borderRadius: 8 },
  primaryButtonText: { color: '#FFFDF9', fontSize: 14, fontWeight: '700' },
  proof: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proofText: { color: '#FFF7E6', fontSize: 12.5, fontWeight: '500' },
  mobileHero: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  mobileImageFrame: { height: 300, position: 'relative', backgroundColor: '#E9DED1' },
  mobileImageVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,12,22,0.18)' },
  mobileEyebrow: { position: 'absolute', left: 20, top: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mobileCopyPanel: { paddingHorizontal: 22, paddingTop: 23, paddingBottom: 18 },
  mobileTitle: { fontFamily: 'Cormorant Garamond', fontSize: 37, lineHeight: 38, letterSpacing: -0.4, fontWeight: '600' },
  mobileSubtitle: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  mobileButton: { minHeight: 50, marginTop: 20, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mobileButtonText: { color: '#FFFDF9', fontSize: 14, fontWeight: '700' },
  mobileProof: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mobileProofText: { fontSize: 10.5, fontWeight: '600' },
});
