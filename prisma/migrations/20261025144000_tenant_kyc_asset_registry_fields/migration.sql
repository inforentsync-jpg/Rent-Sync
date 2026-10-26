ALTER TABLE "tenants"
ADD COLUMN "businessName" VARCHAR(160),
ADD COLUMN "fullAddress" TEXT,
ADD COLUMN "aadhaarNumber" VARCHAR(20),
ADD COLUMN "fatherName" VARCHAR(120),
ADD COLUMN "email" VARCHAR(254),
ADD COLUMN "photoDataUrl" TEXT;

ALTER TABLE "assets"
ADD COLUMN "roomNumber" VARCHAR(40),
ADD COLUMN "ksmartBuildingId" VARCHAR(60),
ADD COLUMN "ksrbId" VARCHAR(60);
