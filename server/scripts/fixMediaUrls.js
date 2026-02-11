const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const FROM = "http://localhost:4000";
const TO = process.env.PUBLIC_BASE_URL; // обязательно задай при запуске

async function main() {
  if (!TO) throw new Error("Set PUBLIC_BASE_URL in env before running script");

  // Posts
  const posts = await prisma.post.findMany({
    select: { id: true, imageUrl: true, videoUrl: true },
  });

  for (const p of posts) {
    const nextImage = p.imageUrl?.startsWith(FROM) ? p.imageUrl.replace(FROM, TO) : p.imageUrl;
    const nextVideo = p.videoUrl?.startsWith(FROM) ? p.videoUrl.replace(FROM, TO) : p.videoUrl;

    if (nextImage !== p.imageUrl || nextVideo !== p.videoUrl) {
      await prisma.post.update({
        where: { id: p.id },
        data: { imageUrl: nextImage, videoUrl: nextVideo },
      });
      console.log("Fixed post", p.id);
    }
  }

  // Users avatars
  const users = await prisma.user.findMany({ select: { id: true, avatarUrl: true } });
  for (const u of users) {
    const nextAvatar = u.avatarUrl?.startsWith(FROM) ? u.avatarUrl.replace(FROM, TO) : u.avatarUrl;
    if (nextAvatar !== u.avatarUrl) {
      await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: nextAvatar } });
      console.log("Fixed user", u.id);
    }
  }

  console.log("Done ✅");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => prisma.$disconnect());
