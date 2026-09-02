/**
 * components/checkout/ReceiptStep.tsx
 * Paso 3 del Checkout — Adjuntar comprobante de pago con soporte de Drag & Drop y selección de archivo.
 */
import { useState, useEffect } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { Button } from '@/components/ui/Button';
import type { ReceiptData } from '@/services/saleStorage';
import { useToast } from '@/components/ui/Toast';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

type Props = {
  receipt?: ReceiptData;
  onReceiptChange: (receipt: ReceiptData) => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function ReceiptStep({ receipt, onReceiptChange, onConfirm, loading = false }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const deviceClass = useDeviceClass();
  const [dragOver, setDragOver] = useState(false);
  const hasReceipt = Boolean(receipt && receipt.fileName);

  // Limpiar blob URLs al desmontar o al cambiar para evitar memory leaks
  useEffect(() => {
    return () => {
      if (receipt?.previewUri && receipt.previewUri.startsWith('blob:')) {
        URL.revokeObjectURL(receipt.previewUri);
      }
    };
  }, [receipt?.previewUri]);

  const handlePickFile = async () => {
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp,application/pdf';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            if (!ALLOWED_TYPES.includes(file.type)) {
              toast.show({ message: 'Formato no compatible. Usa JPG, PNG, WEBP o PDF.', type: 'error' });
              return;
            }
            if (file.size > MAX_FILE_SIZE) {
              toast.show({ message: 'El archivo supera el máximo de 10 MB.', type: 'error' });
              return;
            }
            const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
            const objectUrl = URL.createObjectURL(file);

            // Revocar el anterior si existe
            if (receipt?.previewUri && receipt.previewUri.startsWith('blob:')) {
              URL.revokeObjectURL(receipt.previewUri);
            }

            onReceiptChange({
              fileName: file.name,
              fileSize: sizeMb,
              fileType: file.type,
              previewUri: objectUrl,
              uploadedAt: new Date().toISOString(),
            });
          }
        };
        input.click();
      }
    } else {
      // Use expo-document-picker for mobile
      try {
        const DocumentPicker = require('expo-document-picker');
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          if (asset.size && asset.size > MAX_FILE_SIZE) {
            toast.show({ message: 'El archivo supera el máximo de 10 MB.', type: 'error' });
            return;
          }
          const sizeMb = asset.size ? (asset.size / (1024 * 1024)).toFixed(1) + ' MB' : 'Desconocido';
          onReceiptChange({
            fileName: asset.name,
            fileSize: sizeMb,
            fileType: asset.mimeType || 'unknown',
            previewUri: asset.uri,
            uploadedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Error picking document', err);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 20 }]}>
          Adjunta tu comprobante
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 4 }]}>
          Sube una captura o PDF de la transferencia para validar tu pedido al instante.
        </Text>
      </View>

      {!hasReceipt ? (
        <Pressable
          onPress={handlePickFile}
          onHoverIn={() => setDragOver(true)}
          onHoverOut={() => setDragOver(false)}
          style={[
            styles.uploadBox,
            {
              backgroundColor: dragOver ? theme.colors.lavender : theme.colors.surface,
              borderColor: dragOver ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.radius.xl,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Toca para subir comprobante"
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: theme.colors.lavender, borderRadius: theme.radius.full },
            ]}
          >
            <Feather name="upload-cloud" size={32} color={theme.colors.primary} />
          </View>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginTop: 14, fontWeight: '600', textAlign: 'center' }]}>
            Toca para tomar foto o seleccionar archivo
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 6, textAlign: 'center' }]}>
            Formatos: JPG, PNG, WEBP, PDF • Máx. 10 MB
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.previewCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, borderColor: theme.colors.border }]}>
          <View style={styles.previewHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View
                style={[
                  styles.checkCircle,
                  { backgroundColor: theme.colors.lavender, borderRadius: theme.radius.full },
                ]}
              >
                <Feather name="check" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, fontWeight: '600' }]} numberOfLines={1}>
                  {receipt?.fileName}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {receipt?.fileSize} • Listo para confirmar
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={handlePickFile} style={styles.fileAction} accessibilityRole="button" accessibilityLabel="Cambiar comprobante">
                <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '600' }]}>
                  Cambiar
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  onReceiptChange({
                    fileName: '',
                    fileSize: '',
                    fileType: '',
                    previewUri: '',
                    uploadedAt: '',
                  })
                }
                style={styles.fileAction}
                accessibilityRole="button"
                accessibilityLabel="Eliminar comprobante"
              >
                <Feather name="trash-2" size={14} color="#BE123C" />
              </Pressable>
            </View>
          </View>

          {receipt?.previewUri && receipt.fileType !== 'application/pdf' && (
            <View style={[styles.imagePreviewWrap, { backgroundColor: theme.colors.background, borderRadius: theme.radius.md, height: deviceClass === 'desktop' ? 260 : 300 }]}>
              <Image source={{ uri: receipt.previewUri }} style={styles.previewImage} resizeMode="contain" />
            </View>
          )}
          {receipt?.previewUri && receipt.fileType === 'application/pdf' && (
            <View style={[styles.pdfPreview, { backgroundColor: theme.colors.ivory, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
              <Feather name="file-text" size={38} color={theme.colors.primary} />
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text, marginTop: 10 }]}>Documento PDF listo</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 3 }]} numberOfLines={1}>{receipt.fileName}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <Button
          label="Confirmar comprobante →"
          onPress={onConfirm}
          disabled={!hasReceipt}
          loading={loading}
          variant="primary"
          size="lg"
          icon="check-circle"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 20,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  iconCircle: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  checkCircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  imagePreviewWrap: {
    height: 180,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  pdfPreview: { minHeight: 210, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  footer: {
    marginTop: 24,
  },
});
