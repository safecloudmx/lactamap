export type ExpirationLevel = 'ok' | 'attention' | 'risk' | 'expired';

export interface ExpirationInfo {
  label: string;
  color: string;
  level: ExpirationLevel;
  daysRemaining: number;
}

export function getExpirationInfo(
  expirationDate: string | null | undefined,
  storageStatus: string,
): ExpirationInfo | null {
  if (!expirationDate || storageStatus === 'CONSUMED') return null;

  const now = new Date();
  const exp = new Date(expirationDate);
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { label: 'Expirado', color: '#8b5cf6', level: 'expired', daysRemaining: diffDays };
  }

  if (storageStatus === 'FROZEN') {
    if (diffDays <= 10) {
      return { label: 'En riesgo', color: '#ef4444', level: 'risk', daysRemaining: diffDays };
    }
    if (diffDays <= 30) {
      return { label: 'Atención', color: '#f59e0b', level: 'attention', daysRemaining: diffDays };
    }
    return { label: 'Vigente', color: '#22c55e', level: 'ok', daysRemaining: diffDays };
  }

  // REFRIGERATED (4 days = 96 hours)
  if (diffDays <= 1) {
    return { label: 'En riesgo', color: '#ef4444', level: 'risk', daysRemaining: diffDays };
  }
  if (diffDays <= 2) {
    return { label: 'Atención', color: '#f59e0b', level: 'attention', daysRemaining: diffDays };
  }
  return { label: 'Vigente', color: '#22c55e', level: 'ok', daysRemaining: diffDays };
}

export function formatDaysRemaining(days: number): string {
  if (days <= 0) return 'Expirado';
  if (days === 1) return '1 día';
  if (days < 30) return `${days} días`;
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (remDays === 0) return months === 1 ? '1 mes' : `${months} meses`;
  return months === 1 ? `1 mes y ${remDays}d` : `${months}m ${remDays}d`;
}
