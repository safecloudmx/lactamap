import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Download, Share2 } from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';

let Sharing: any = null;
try { Sharing = require('expo-sharing'); } catch (_) {}
let ViewShot: any = null;
try { ViewShot = require('react-native-view-shot'); } catch (_) {}

const WEB_BASE_URL = 'https://lactamap.app';

interface Props {
  folio: string;
  size?: number;
}

export default function PumpingQRCode({ folio, size = 180 }: Props) {
  const svgRef = useRef<any>(null);
  const qrValue = `${WEB_BASE_URL}/folio-detalle?folio=${encodeURIComponent(folio)}`;

  const createImageWithFolio = (qrBase64: string): Promise<string> => {
    return new Promise((resolve) => {
      if (Platform.OS !== 'web') {
        resolve(qrBase64);
        return;
      }
      const canvas = document.createElement('canvas');
      const padding = 24;
      const textHeight = 32;
      const canvasSize = size + padding * 2;
      canvas.width = canvasSize;
      canvas.height = canvasSize + textHeight;
      const ctx = canvas.getContext('2d')!;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw QR
      const img = new (window as any).Image();
      img.onload = () => {
        ctx.drawImage(img, padding, padding, size, size);
        // Draw folio text
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(folio, canvas.width / 2, canvasSize + textHeight - 8);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      };
      img.src = `data:image/png;base64,${qrBase64}`;
    });
  };

  const handleDownloadWeb = () => {
    if (Platform.OS !== 'web' || !svgRef.current) return;
    svgRef.current.toDataURL(async (data: string) => {
      const finalData = await createImageWithFolio(data);
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${finalData}`;
      link.download = `${folio}.png`;
      link.click();
    });
  };

  const handleShareNative = async () => {
    if (Platform.OS === 'web') {
      handleDownloadWeb();
      return;
    }
    if (!svgRef.current) return;
    svgRef.current.toDataURL(async (data: string) => {
      if (Sharing && await Sharing.isAvailableAsync()) {
        try {
          const FileSystem = require('expo-file-system');
          const uri = FileSystem.cacheDirectory + `${folio}.png`;
          await FileSystem.writeAsStringAsync(uri, data, { encoding: 'base64' });
          await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        } catch (e) {
          console.warn('Share failed:', e);
        }
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.qrWrapper}>
        <QRCode
          value={qrValue}
          size={size}
          backgroundColor={colors.white}
          color={colors.slate[800]}
          getRef={(ref: any) => { svgRef.current = ref; }}
        />
      </View>
      <Text style={styles.folioText}>{folio}</Text>
      <TouchableOpacity style={styles.actionBtn} onPress={handleShareNative} activeOpacity={0.7}>
        {Platform.OS === 'web' ? (
          <>
            <Download size={16} color={colors.info} />
            <Text style={styles.actionBtnText}>Descargar QR</Text>
          </>
        ) : (
          <>
            <Share2 size={16} color={colors.info} />
            <Text style={styles.actionBtnText}>Compartir QR</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  qrWrapper: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  folioText: {
    ...typography.bodyBold,
    color: colors.slate[700],
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.infoLight,
  },
  actionBtnText: {
    ...typography.smallBold,
    color: colors.info,
  },
});
