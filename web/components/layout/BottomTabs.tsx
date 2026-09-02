/**
 * components/layout/BottomTabs.tsx
 * Navegación inferior mobile con Feather icons y touch targets adecuados.
 */
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';

type TabItem = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  href: string;
  external?: boolean;
};

const TABS: TabItem[] = [
  { label: 'Inicio', icon: 'grid', href: '/' },
  { label: 'Catálogo', icon: 'shopping-bag', href: '/venta' },
  { label: 'Compras', icon: 'package', href: '/historial' },
  { label: 'WhatsApp', icon: 'message-circle', href: 'https://wa.me/56997310398', external: true },
];

export function BottomTabs() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingBottom: theme.spacing.sm,
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = !tab.external && pathname === tab.href;
        return (
          <Pressable
            key={tab.href}
            onPress={() => tab.external ? Linking.openURL(tab.href) : router.push(tab.href as never)}
            style={[styles.tab, { minHeight: theme.touchTarget.min }]}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.iconWrap, active && { backgroundColor: theme.colors.lavender }]}>
              <Feather name={tab.icon} size={19} color={active ? theme.colors.primary : theme.colors.textSecondary} />
            </View>
            <Text
              style={[
                theme.typography.caption,
                {
                  color: active ? theme.colors.primary : theme.colors.textSecondary,
                  fontWeight: active ? '600' : '400',
                  marginTop: 3,
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 38, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
