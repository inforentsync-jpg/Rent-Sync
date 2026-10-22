CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "assetType" VARCHAR(60) NOT NULL,
    "unitNumber" VARCHAR(40) NOT NULL,
    "monthlyRent" INTEGER NOT NULL,
    "securityDeposit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "mobileNumber" VARCHAR(15) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_tenants" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rental_agreements" (
    "id" TEXT NOT NULL,
    "agreementNumber" VARCHAR(40) NOT NULL,
    "assetId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "monthlyRent" INTEGER NOT NULL,
    "securityDeposit" INTEGER NOT NULL DEFAULT 0,
    "terms" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rental_agreements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgreementCounter" (
    "assetId" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AgreementCounter_pkey" PRIMARY KEY ("assetId")
);

ALTER TABLE "buildings" ADD COLUMN "companyId" TEXT;
CREATE INDEX "buildings_companyId_idx" ON "buildings"("companyId");
CREATE INDEX "companies_ownerId_idx" ON "companies"("ownerId");
CREATE UNIQUE INDEX "assets_buildingId_unitNumber_key" ON "assets"("buildingId", "unitNumber");
CREATE INDEX "assets_buildingId_idx" ON "assets"("buildingId");
CREATE UNIQUE INDEX "tenants_mobileNumber_key" ON "tenants"("mobileNumber");
CREATE INDEX "tenants_ownerId_idx" ON "tenants"("ownerId");
CREATE UNIQUE INDEX "asset_tenants_assetId_tenantId_key" ON "asset_tenants"("assetId", "tenantId");
CREATE INDEX "asset_tenants_tenantId_idx" ON "asset_tenants"("tenantId");
CREATE UNIQUE INDEX "rental_agreements_agreementNumber_key" ON "rental_agreements"("agreementNumber");
CREATE INDEX "rental_agreements_assetId_startDate_endDate_idx" ON "rental_agreements"("assetId", "startDate", "endDate");
CREATE INDEX "rental_agreements_tenantId_startDate_idx" ON "rental_agreements"("tenantId", "startDate");

ALTER TABLE "companies" ADD CONSTRAINT "companies_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "property_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_buildingId_fkey"
FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "property_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_tenants" ADD CONSTRAINT "asset_tenants_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_tenants" ADD CONSTRAINT "asset_tenants_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementCounter" ADD CONSTRAINT "AgreementCounter_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
