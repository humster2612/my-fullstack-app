/*
  Warnings:

  - You are about to drop the column `videoUrl` on the `Post` table. All the data in the column will be lost.
  - Made the column `imageUrl` on table `Post` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "videoUrl",
ALTER COLUMN "imageUrl" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "username" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Availability" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Availability_providerId_startsAt_idx" ON "Availability"("providerId", "startsAt");

-- CreateIndex
CREATE INDEX "Availability_isBooked_idx" ON "Availability"("isBooked");

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
