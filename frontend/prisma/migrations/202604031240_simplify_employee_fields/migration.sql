ALTER TABLE "Employee"
  DROP COLUMN IF EXISTS "description",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "tags",
  DROP COLUMN IF EXISTS "title",
  DROP COLUMN IF EXISTS "specialization",
  DROP COLUMN IF EXISTS "active",
  DROP COLUMN IF EXISTS "attributes",
  DROP COLUMN IF EXISTS "context";
