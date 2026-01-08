-- DropForeignKey
ALTER TABLE "public"."Report" DROP CONSTRAINT "Report_postId_fkey";

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
