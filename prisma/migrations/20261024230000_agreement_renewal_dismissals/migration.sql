CREATE TABLE "agreement_renewal_dismissals" (
    "assetId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_renewal_dismissals_pkey" PRIMARY KEY ("assetId", "tenantId", "agreementYear")
);

CREATE INDEX "agreement_renewal_dismissals_tenantId_idx"
ON "agreement_renewal_dismissals"("tenantId");

ALTER TABLE "agreement_renewal_dismissals"
ADD CONSTRAINT "agreement_renewal_dismissals_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agreement_renewal_dismissals"
ADD CONSTRAINT "agreement_renewal_dismissals_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
