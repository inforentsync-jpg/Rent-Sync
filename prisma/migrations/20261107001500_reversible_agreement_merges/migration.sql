ALTER TABLE "rental_agreements"
ADD COLUMN "mergedIntoAgreementId" TEXT,
ADD COLUMN "mergedOriginalStatus" VARCHAR(20),
ADD COLUMN "mergedOriginalStartDate" DATE,
ADD COLUMN "mergedOriginalEndDate" DATE,
ADD COLUMN "mergedOriginalAgreementYear" INTEGER,
ADD COLUMN "mergedOriginalMonthlyRent" INTEGER,
ADD COLUMN "mergedOriginalSecurityDeposit" INTEGER,
ADD COLUMN "mergedOriginalOwnerApprovedAt" TIMESTAMPTZ(6),
ADD COLUMN "mergedOriginalTenantApprovedAt" TIMESTAMPTZ(6),
ADD COLUMN "mergedOriginalMandatoryDetailsApprovedAt" TIMESTAMPTZ(6);

CREATE INDEX "rental_agreements_mergedIntoAgreementId_idx"
ON "rental_agreements"("mergedIntoAgreementId");

ALTER TABLE "rental_agreements"
ADD CONSTRAINT "rental_agreements_mergedIntoAgreementId_fkey"
FOREIGN KEY ("mergedIntoAgreementId") REFERENCES "rental_agreements"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
