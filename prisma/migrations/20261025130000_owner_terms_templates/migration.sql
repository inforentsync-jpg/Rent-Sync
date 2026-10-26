CREATE TABLE "owner_term_templates" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_term_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "owner_term_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_term_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_term_templates" (
    "assetId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_term_templates_pkey" PRIMARY KEY ("assetId", "templateId")
);

CREATE INDEX "owner_term_templates_ownerId_createdAt_idx" ON "owner_term_templates"("ownerId", "createdAt");
CREATE UNIQUE INDEX "owner_term_items_templateId_position_key" ON "owner_term_items"("templateId", "position");
CREATE INDEX "asset_term_templates_templateId_idx" ON "asset_term_templates"("templateId");

ALTER TABLE "owner_term_templates"
ADD CONSTRAINT "owner_term_templates_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "property_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "owner_term_items"
ADD CONSTRAINT "owner_term_items_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "owner_term_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_term_templates"
ADD CONSTRAINT "asset_term_templates_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_term_templates"
ADD CONSTRAINT "asset_term_templates_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "owner_term_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
