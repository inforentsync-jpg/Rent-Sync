ALTER TABLE "tenants"
ADD COLUMN "publicShareTokenHash" TEXT;

CREATE UNIQUE INDEX "tenants_publicShareTokenHash_key"
ON "tenants"("publicShareTokenHash");
