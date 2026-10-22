CREATE TABLE "property_owners" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "mobileNumber" VARCHAR(15) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_owners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "property_owners_mobileNumber_key" ON "property_owners"("mobileNumber");

ALTER TABLE "buildings" ADD COLUMN "ownerId" TEXT;

CREATE INDEX "buildings_ownerId_idx" ON "buildings"("ownerId");

ALTER TABLE "buildings"
ADD CONSTRAINT "buildings_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "property_owners"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
