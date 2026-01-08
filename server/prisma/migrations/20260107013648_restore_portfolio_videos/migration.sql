/*
  Warnings:

  - You are about to drop the `PortfolioItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PortfolioItem" DROP CONSTRAINT "PortfolioItem_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "portfolioVideos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "public"."PortfolioItem";

-- DropEnum
DROP TYPE "public"."PortfolioItemType";
