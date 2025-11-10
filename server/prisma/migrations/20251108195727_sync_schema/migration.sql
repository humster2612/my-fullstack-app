/*
  Warnings:

  - You are about to drop the `Availability` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Availability" DROP CONSTRAINT "Availability_providerId_fkey";

-- DropTable
DROP TABLE "public"."Availability";
