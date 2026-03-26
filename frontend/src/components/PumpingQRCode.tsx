import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Download, Share2, Lock, Globe } from 'lucide-react-native';
import { colors, spacing, typography, radii, shadows } from '../theme';

let Sharing: any = null;
try { Sharing = require('expo-sharing'); } catch (_) {}

const WEB_BASE_URL = 'https://lactamap.app';

interface Props {
  folio: string;
  publicToken?: string;
  size?: number;
}

function createImageWithLabel(qrBase64: string, label: string, qrSize: number): Promise<string> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web') {
      resolve(qrBase64);
      return;
    }
    const canvas = document.createElement('canvas');
    const padding = 24;
    const textHeight = 32;
    const canvasSize = qrSize + padding * 2;
    canvas.width = canvasSize;
    canvas.height = canvasSize + textHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new (window as any).Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, qrSize, qrSize);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, canvas.width / 2, canvasSize + textHeight - 8);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.src = `data:image/png;base64,${qrBase64}`;
  });
}

function QRCard({
  value,
  label,
  sublabel,
  icon,
  iconColor,
  size,
  filename,
}: {
  value: string;
  label: string;
  sublabel: string;
  icon: 'lock' | 'globe';
  iconColor: string;
  size: number;
  filename: string;
}) {
  const svgRef = useRef<any>(null);
  const IconComp = icon === 'lock' ? Lock : Globe;

  const handleAction = async () => {
    if (!svgRef.current) return;
    svgRef.current.toDataURL(async (data: string) => {
      if (Platform.OS === 'web') {
        const finalData = await createImageWithLabel(data, label, size);
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${finalData}`;
        link.download = `${filename}.png`;
        link.click();
      } else if (Sharing && await Sharing.isAvailableAsync()) {
        try {
          const FileSystem = require('expo-file-system');
          const uri = FileSystem.cacheDirectory + `${filename}.png`;
          await FileSystem.writeAsStringAsync(uri, data, { encoding: 'base64' });
          await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        } catch (e) {
          console.warn('Share failed:', e);
        }
      }
    });
  };

  return (
    <View style={styles.qrCard}>
      <View style={styles.qrCardHeader}>
        <IconComp size={14} color={iconColor} />
        <Text style={[styles.qrCardLabel, { color: iconColor }]}>{sublabel}</Text>
      </View>
      <View style={styles.qrWrapper}>
        <QRCode
          value={value}
          size={size}
          backgroundColor={colors.white}
          color={colors.slate[800]}
          getRef={(ref: any) => { svgRef.current = ref; }}
        />
      </View>
      <Text style={styles.folioText} numberOfLines={1}>{label}</Text>
      <TouchableOpacity style={styles.actionBtn} onPress={handleAction} activeOpacity={0.7}>
        {Platform.OS === 'web' ? (
          <>
            <Download size={14} color={colors.info} />
            <Text style={styles.actionBtnText}>Descargar</Text>
          </>
        ) : (
          <>
            <Share2 size={14} color={colors.info} />
            <Text style={styles.actionBtnText}>Compartir</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function PumpingQRCode({ folio, publicToken, size = 140 }: Props) {
  const privateUrl = `${WEB_BASE_URL}/folio-detalle?folio=${encodeURIComponent(folio)}`;
  const publicUrl = publicToken
    ? `${WEB_BASE_URL}/folio-publico?token=${encodeURIComponent(publicToken)}`
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.qrRow}>
        <QRCard
          value={privateUrl}
          label={folio}
          sublabel="Privado"
          icon="lock"
          iconColor={colors.slate[500]}
          size={size}
          filename={`${folio}-privado`}
        />
        {publicUrl && (
          <QRCard
            value={publicUrl}
            label="Compartir"
            sublabel="Público"
            icon="globe"
            iconColor={colors.success}
            size={size}
            filename={`${folio}-publico`}
          />
        )}
      </View>
      <Text style={styles.hintText}>
        El QR privado requiere sesión iniciada. El público muestra datos limitados.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  qrRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  qrCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  qrCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qrCardLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  qrWrapper: {
    padding: spacing.sm,
  },
  folioText: {
    ...typography.smallBold,
    color: colors.slate[700],
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    maxWidth: 160,
    textAlign: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.infoLight,
  },
  actionBtnText: {
    ...typography.caption,
    color: colors.info,
    fontWeight: '600',
  },
  hintText: {
    ...typography.caption,
    color: colors.slate[400],
    textAlign: 'center',
    maxWidth: 320,
  },
});
