CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "postalCode" VARCHAR(12) NOT NULL,
    "ownerName" VARCHAR(120) NOT NULL,
    "ownerMobile" VARCHAR(15) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "buildings_createdAt_idx" ON "buildings"("createdAt");
