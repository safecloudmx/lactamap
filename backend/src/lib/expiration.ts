export function calculateExpiration(
  storageStatus: string,
  referenceDate: Date,
): Date | null {
  if (storageStatus === 'CONSUMED') return null;

  const expDate = new Date(referenceDate);
  if (storageStatus === 'FROZEN') {
    expDate.setMonth(expDate.getMonth() + 4);
  } else if (storageStatus === 'REFRIGERATED') {
    expDate.setDate(expDate.getDate() + 4);
  }
  return expDate;
}
