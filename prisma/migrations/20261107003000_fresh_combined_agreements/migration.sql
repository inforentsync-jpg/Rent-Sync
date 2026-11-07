DROP INDEX IF EXISTS "rental_agreements_tenantId_assetId_agreementYear_key";

CREATE UNIQUE INDEX "rental_agreements_active_tenant_asset_year_key"
ON "rental_agreements"("tenantId", "assetId", "agreementYear")
WHERE "mergedIntoAgreementId" IS NULL AND "status" <> 'CANCELLED';
