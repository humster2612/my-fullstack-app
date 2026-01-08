/*
  Warnings:

  - You are about to drop the column `portfolioVideos` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PortfolioItemType" AS ENUM ('VIDEO', 'PHOTO', 'LINK');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "portfolioVideos";

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "PortfolioItemType" NOT NULL DEFAULT 'LINK',
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioItem_userId_order_idx" ON "PortfolioItem"("userId", "order");

-- CreateIndex
CREATE INDEX "PortfolioItem_userId_createdAt_idx" ON "PortfolioItem"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
