ALTER TABLE "tenants" ALTER COLUMN "mobileNumber" DROP NOT NULL;

ALTER TABLE "assets"
ADD COLUMN "externalBuildingId" VARCHAR(40),
ADD COLUMN "ward" VARCHAR(20);
