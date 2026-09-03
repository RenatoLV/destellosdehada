/**
 * hooks/useDeviceClass.ts
 * Deriva mobile/tablet/desktop del ancho actual (sección 62).
 * Reactivo a resize (web/desktop) y a rotación (tablet).
 */
import { useWindowDimensions } from 'react-native';
import { getDeviceClass, type DeviceClass } from '@/theme';

export function useDeviceClass(): DeviceClass {
  const { width } = useWindowDimensions();
  return getDeviceClass(width);
}
