import prisma from './prisma';

/** Returns the IDs of all babies a user can access (owns OR has been granted access to). */
export async function getAccessibleBabyIds(userId: string): Promise<string[]> {
  const accesses = await prisma.babyAccess.findMany({
    where: { userId },
    select: { babyId: true },
  });
  return accesses.map((a) => a.babyId);
}

/** Returns true if userId owns or has BabyAccess to the given babyId. */
export async function hasAccessToBaby(userId: string, babyId: string): Promise<boolean> {
  const baby = await prisma.baby.findUnique({ where: { id: babyId }, select: { userId: true } });
  if (!baby) return false;
  if (baby.userId === userId) return true;
  const access = await prisma.babyAccess.findFirst({ where: { babyId, userId } });
  return !!access;
}

/** Returns the active partnership for a user (if any), with the partner's public fields. */
export async function getPartnership(userId: string) {
  return prisma.userPartnership.findFirst({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, name: true, email: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
}
