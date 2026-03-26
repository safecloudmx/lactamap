import prisma from './prisma';

function sideCode(side: string): string {
  if (side === 'LEFT') return 'I';
  if (side === 'RIGHT') return 'D';
  return 'ID'; // BOTH
}

function babyInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3);
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function buildFolio(side: string, pumpedAt: Date, babyName?: string | null): string {
  const yy = pad2(pumpedAt.getFullYear() % 100);
  const mm = pad2(pumpedAt.getMonth() + 1);
  const dd = pad2(pumpedAt.getDate());
  const hh = pad2(pumpedAt.getHours());
  const min = pad2(pumpedAt.getMinutes());

  const sc = sideCode(side);
  const datePart = `${yy}${mm}${dd}`;
  const timePart = `${hh}${min}`;

  if (babyName) {
    return `${babyInitials(babyName)}-${sc}${datePart}-${timePart}`;
  }
  return `${sc}${datePart}-${timePart}`;
}

export async function generateUniqueFolio(
  side: string,
  pumpedAt: Date,
  babyName?: string | null,
): Promise<string> {
  const base = buildFolio(side, pumpedAt, babyName);
  let folio = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.pumpingSession.findUnique({ where: { folio } });
    if (!existing) return folio;
    folio = `${base}-${suffix}`;
    suffix++;
    if (suffix > 99) break; // safety
  }

  return folio;
}
