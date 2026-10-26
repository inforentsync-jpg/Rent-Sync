UPDATE "rental_agreements"
SET "status" = 'ACTIVE'
WHERE "status" = 'DRAFT'
  AND "ownerApprovedAt" IS NOT NULL;
