import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ReceiptSelection } from '../../domain/pos';
import { ReceiptMimeType } from '../../types/database';
import { POSColors, POSRadius } from '../../constants/posTheme';

interface Props {
  receipt: ReceiptSelection | null;
  onSelect: (receipt: ReceiptSelection) => Promise<void>;
  onRemove: () => void;
  disabled?: boolean;
}

function assetToReceipt(asset: ImagePicker.ImagePickerAsset): ReceiptSelection {
  const mimeType = (asset.mimeType || 'image/jpeg') as ReceiptMimeType;
  return {
    localUri: asset.uri,
    mimeType,
    fileName: asset.fileName ?? `comprobante.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
    fileSize: asset.fileSize,
  };
}

export function ReceiptPicker({ receipt, onSelect, onRemove, disabled = false }: Props) {
  const [loading, setLoading] = useState(false);

  const choose = async (camera: boolean) => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Se necesita permiso de cámara para tomar el comprobante.');
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted && Platform.OS !== 'web') throw new Error('Se necesita permiso para elegir el comprobante.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.88 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.92 });
      if (!result.canceled && result.assets[0]) await onSelect(assetToReceipt(result.assets[0]));
    } catch (error) {
      Alert.alert(
        'No se pudo seleccionar el comprobante',
        error instanceof Error ? error.message : 'Intenta nuevamente con otro archivo.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (receipt) {
    return (
      <View style={styles.previewCard}>
        <Image source={{ uri: receipt.localUri }} style={styles.preview} resizeMode="cover" />
        <View style={styles.previewInfo}>
          <View style={styles.validRow}><Feather name="check-circle" size={16} color={POSColors.success} /><Text style={styles.validText}>Archivo válido</Text></View>
          <Text style={styles.fileName} numberOfLines={1}>{receipt.fileName ?? 'Comprobante de transferencia'}</Text>
          <Text style={styles.fileMeta}>{receipt.fileSize ? `${(receipt.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Tamaño verificado'} · {receipt.mimeType}</Text>
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cambiar comprobante" style={styles.secondaryButton} onPress={() => void choose(false)} disabled={disabled || loading}>
              <Feather name="refresh-cw" size={15} color={POSColors.plum} /><Text style={styles.secondaryText}>Cambiar</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Eliminar comprobante" style={styles.deleteButton} onPress={onRemove} disabled={disabled}>
              <Feather name="trash-2" size={15} color={POSColors.danger} /><Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.emptyCard}>
      <View style={styles.iconCircle}>{loading ? <ActivityIndicator color={POSColors.plum} /> : <Feather name="camera" size={25} color={POSColors.plum} />}</View>
      <Text style={styles.title}>Adjunta el comprobante</Text>
      <Text style={styles.subtitle}>{Platform.OS === 'web' ? 'Selecciona una imagen desde tu equipo.' : 'Toma una foto nítida o elige una imagen de tu galería.'}</Text>
      <View style={styles.actions}>
        {Platform.OS !== 'web' && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tomar foto del comprobante" accessibilityHint="Abre la cámara" style={styles.primaryButton} onPress={() => void choose(true)} disabled={disabled || loading}>
            <Feather name="camera" size={17} color={POSColors.white} /><Text style={styles.primaryText}>Tomar foto</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Elegir comprobante" accessibilityHint="Abre la galería o selector de archivos" style={styles.secondaryButton} onPress={() => void choose(false)} disabled={disabled || loading}>
          <Feather name="image" size={17} color={POSColors.plum} /><Text style={styles.secondaryText}>Elegir imagen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: { minHeight: 250, borderRadius: POSRadius.large, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CDBDD5', backgroundColor: POSColors.surface, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: POSColors.plumSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: POSColors.ink, fontSize: 17, fontWeight: '800', marginTop: 14 },
  subtitle: { color: POSColors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 340, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  primaryButton: { minHeight: 46, borderRadius: POSRadius.medium, paddingHorizontal: 18, backgroundColor: POSColors.plum, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: POSColors.white, fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 46, borderRadius: POSRadius.medium, paddingHorizontal: 16, backgroundColor: POSColors.plumSoft, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: POSColors.plum, fontSize: 13, fontWeight: '800' },
  deleteButton: { minHeight: 46, borderRadius: POSRadius.medium, paddingHorizontal: 16, backgroundColor: POSColors.dangerSoft, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: POSColors.danger, fontSize: 13, fontWeight: '800' },
  previewCard: { borderRadius: POSRadius.large, overflow: 'hidden', borderWidth: 1, borderColor: POSColors.border, backgroundColor: POSColors.surface },
  preview: { width: '100%', height: 230, backgroundColor: POSColors.surfaceMuted },
  previewInfo: { padding: 18 },
  validRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  validText: { color: POSColors.success, fontSize: 12, fontWeight: '800' },
  fileName: { color: POSColors.ink, fontSize: 15, fontWeight: '800', marginTop: 8 },
  fileMeta: { color: POSColors.muted, fontSize: 11, marginTop: 4 },
});
