
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = 'lacta@wari.mx';
  const password = 'testingtest';
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: hashedPassword,
        role: 'OWNER',
      },
      create: {
        email,
        passwordHash: hashedPassword,
        role: 'OWNER',
      },
    });
    console.log('Admin user created/updated:', user);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
