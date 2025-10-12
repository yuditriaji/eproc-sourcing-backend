import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.env.VENDOR_EMAIL;
  if (!email) {
    throw new Error('VENDOR_EMAIL env var is required');
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
        isActive: true,
      },
      select: { id: true, email: true, role: true, isVerified: true, isActive: true },
    });
    console.log(JSON.stringify({ ok: true, user }));
  } catch (e: any) {
    console.error(JSON.stringify({ ok: false, error: e?.message || String(e) }));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e?.message || String(e) }));
  process.exit(1);
});
