// server/scripts/backfillUsernames.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function makeNameFromEmail(email) {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20) || 'user';
  const suffix = Math.floor(Math.random() * 10000);
  return `${base}${suffix}`;
}

async function main() {
  const users = await prisma.user.findMany({ where: { username: null }, select: { id: true, email: true } });

  for (const u of users) {
    let candidate;
    // подбираем уникальный username
    for (;;) {
      candidate = makeNameFromEmail(u.email);
      const exists = await prisma.user.findUnique({ where: { username: candidate } }).catch(() => null);
      if (!exists) break;
    }

    await prisma.user.update({
      where: { id: u.id },
      data: { username: candidate },
    });

    console.log(`Set username for user ${u.id} -> ${candidate}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
