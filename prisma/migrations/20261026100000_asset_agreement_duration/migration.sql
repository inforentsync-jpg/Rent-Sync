ALTER TABLE "assets"
ADD COLUMN "agreementDurationUnit" VARCHAR(10) NOT NULL DEFAULT 'MONTH',
ADD COLUMN "agreementDurationValue" INTEGER NOT NULL DEFAULT 11,
ADD COLUMN "agreementStartDate" DATE;
