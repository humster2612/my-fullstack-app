-- CreateTable
CREATE TABLE "Unavailability" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unavailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Unavailability_providerId_startsAt_idx" ON "Unavailability"("providerId", "startsAt");

-- CreateIndex
CREATE INDEX "Unavailability_startsAt_endsAt_idx" ON "Unavailability"("startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "Unavailability" ADD CONSTRAINT "Unavailability_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
