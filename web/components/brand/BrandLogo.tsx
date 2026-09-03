import { Platform, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type Props = { variant?: 'full' | 'mark'; inverse?: boolean; width?: number };

export function BrandLogo({ variant = 'full', inverse = false, width = 180 }: Props) {
  const theme = useTheme();
  if (Platform.OS === 'web') {
    const src = variant === 'mark' ? '/brand/dh-monogram.svg' : '/brand/dh-logo-full.svg';
    return <img src={src} width={width} style={{ display: 'block', height: 'auto' }} alt="Destellos de Hada, boutique en Coquimbo" />;
  }
  if (variant === 'mark') {
    return <View style={[styles.nativeMark, { width, height: width, backgroundColor: theme.colors.primaryDark }]}><Text style={styles.nativeMarkText}>DH</Text></View>;
  }
  return <View style={styles.nativeFull}><View style={[styles.nativeMark, { backgroundColor: theme.colors.primaryDark }]}><Text style={styles.nativeMarkText}>DH</Text></View><View><Text style={[styles.nativeTitle, inverse && styles.inverse]}>Destellos de Hada</Text><View style={styles.nativeCaption}><Feather name="minus" size={18} color={theme.colors.champagne} /><Text style={[styles.nativeCaptionText, inverse && styles.inverse]}>JOYERÍA · COQUIMBO</Text></View></View></View>;
}

const styles = StyleSheet.create({
  nativeFull: { flexDirection: 'row', alignItems: 'center', gap: 10 }, nativeMark: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nativeMarkText: { color: '#FFFDF9', fontFamily: 'serif', fontWeight: '800', fontSize: 17 }, nativeTitle: { color: '#2A0C16', fontFamily: 'serif', fontSize: 17 },
  nativeCaption: { flexDirection: 'row', alignItems: 'center' }, nativeCaptionText: { color: '#6F2138', fontSize: 7.5, fontWeight: '700', letterSpacing: 1.5 }, inverse: { color: '#FFFDF9' },
});
