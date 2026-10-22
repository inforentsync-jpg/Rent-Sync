ALTER TABLE "rental_agreements"
ADD COLUMN "importantTerms" TEXT NOT NULL DEFAULT '',
ADD COLUMN "ownerApprovedAt" TIMESTAMPTZ(6),
ADD COLUMN "tenantApprovedAt" TIMESTAMPTZ(6);
