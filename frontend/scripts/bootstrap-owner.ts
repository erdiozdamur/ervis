import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function main() {
  const ownerEmail = process.env.BOOTSTRAP_OWNER_EMAIL;
  const confirmation = process.env.BOOTSTRAP_OWNER_CONFIRM;

  if (!ownerEmail) {
    throw new Error('BOOTSTRAP_OWNER_EMAIL zorunludur.');
  }

  if (confirmation !== 'ASSIGN_OWNER') {
    throw new Error('Güvenlik için BOOTSTRAP_OWNER_CONFIRM=ASSIGN_OWNER değeri zorunludur.');
  }

  const email = normalizeEmail(ownerEmail);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new Error(`Kullanıcı bulunamadı: ${email}`);
  }

  await prisma.userRole.upsert({
    where: {
      userId_role: {
        userId: user.id,
        role: Role.OWNER,
      },
    },
    update: {},
    create: {
      userId: user.id,
      role: Role.OWNER,
    },
  });

  console.log(`OWNER ataması tamamlandı: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
