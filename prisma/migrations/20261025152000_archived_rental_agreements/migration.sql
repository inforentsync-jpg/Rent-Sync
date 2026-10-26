CREATE TABLE "archived_rental_agreements" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "originalAgreementId" TEXT NOT NULL,
    "agreementNumber" VARCHAR(40) NOT NULL,
    "agreementYear" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "monthlyRent" INTEGER NOT NULL,
    "securityDeposit" INTEGER NOT NULL DEFAULT 0,
    "terms" TEXT NOT NULL,
    "importantTerms" TEXT NOT NULL DEFAULT '',
    "status" VARCHAR(20) NOT NULL,
    "ownerApprovedAt" TIMESTAMPTZ(6),
    "tenantApprovedAt" TIMESTAMPTZ(6),
    "tenantName" VARCHAR(120) NOT NULL,
    "tenantMobileNumber" VARCHAR(15),
    "assetName" VARCHAR(120) NOT NULL,
    "assetType" VARCHAR(60) NOT NULL,
    "unitNumber" VARCHAR(40) NOT NULL,
    "buildingName" VARCHAR(160) NOT NULL,
    "buildingAddress" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "templateTerms" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archived_rental_agreements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "archived_rental_agreements_originalAgreementId_key"
ON "archived_rental_agreements"("originalAgreementId");

CREATE INDEX "archived_rental_agreements_ownerId_archivedAt_idx"
ON "archived_rental_agreements"("ownerId", "archivedAt");
