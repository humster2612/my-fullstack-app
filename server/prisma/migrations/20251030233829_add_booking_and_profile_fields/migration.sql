-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'VIDEOGRAPHER', 'PHOTOGRAPHER');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "portfolioVideos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pricePerHour" INTEGER,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'CLIENT',
ADD COLUMN     "specialization" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "videographerId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_videographerId_date_idx" ON "Booking"("videographerId", "date");

-- CreateIndex
CREATE INDEX "Booking_clientId_date_idx" ON "Booking"("clientId", "date");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_videographerId_fkey" FOREIGN KEY ("videographerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
