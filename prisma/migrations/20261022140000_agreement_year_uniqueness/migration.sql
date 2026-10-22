ALTER TABLE "rental_agreements"
ADD COLUMN "agreementYear" INTEGER;

UPDATE "rental_agreements"
SET "agreementYear" = EXTRACT(YEAR FROM "startDate")::INTEGER;

ALTER TABLE "rental_agreements"
ALTER COLUMN "agreementYear" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "rental_agreements"
    GROUP BY "tenantId", "assetId", "agreementYear"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate rental agreements exist for the same tenant, asset, and year. Resolve them before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "rental_agreements_tenantId_assetId_agreementYear_key"
ON "rental_agreements"("tenantId", "assetId", "agreementYear");
