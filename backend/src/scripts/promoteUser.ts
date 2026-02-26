import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'wayo@wari.mx';
  const newPassword = 'AveImperatrix!';
  const newRole = 'ADMIN' as any;

  console.log(`Buscando usuario: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`Error: Usuario ${email} no encontrado.`);
    return;
  }

  console.log('Generando hash de nueva contraseña...');
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  console.log(`Actualizando usuario ${email} a rol ${newRole}...`);
  await prisma.user.update({
    where: { email },
    data: {
      passwordHash: hashedPassword,
      role: newRole,
    },
  });

  console.log('✅ Usuario actualizado correctamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando el script:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
