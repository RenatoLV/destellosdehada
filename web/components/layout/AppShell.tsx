/**
 * components/layout/AppShell.tsx
 * Composición responsiva del shell (sección 13 vs 12): NO es "el mismo layout
 * escalado" — desktop es sidebar + contenido en paralelo, mobile es flujo vertical
 * con tabs abajo (sección 113).
 */
import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomTabs } from '@/components/layout/BottomTabs';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';

type Props = { children: ReactNode };

export function AppShell({ children }: Props) {
  const theme = useTheme();
  const deviceClass = useDeviceClass();
  const isDesktop = deviceClass === 'desktop';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <AnnouncementBar />
      {!isDesktop && <Header deviceClass={deviceClass} />}
      <View style={styles.body}>
        {isDesktop && <Sidebar />}
        <View style={styles.content}>
          {children}
        </View>
      </View>
      {!isDesktop && <BottomTabs />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
  content: { flex: 1 },
});
