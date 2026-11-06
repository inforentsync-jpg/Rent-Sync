ALTER TABLE "buildings"
ADD COLUMN IF NOT EXISTS "panchayat" VARCHAR(120);

ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "businessNature" VARCHAR(160);

ALTER TABLE "rental_agreements"
ADD COLUMN IF NOT EXISTS "mandatoryDetailsApprovedAt" TIMESTAMPTZ(6);
