DROP INDEX IF EXISTS "AppMeta_key_key";

ALTER TABLE "AppMeta"
  ADD COLUMN "namespace" TEXT,
  ADD COLUMN "valueJson" JSONB,
  ADD COLUMN "valueSchemaJson" JSONB,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishedBy" TEXT;

UPDATE "AppMeta"
SET
  "namespace" = CASE
    WHEN "key" LIKE 'ai.%' OR "key" LIKE 'ai_%' THEN 'ai'
    WHEN "key" LIKE 'feature.%' OR "key" LIKE 'feature_%' THEN 'feature'
    ELSE 'app'
  END,
  "key" = CASE
    WHEN "key" = 'app_name' THEN 'name'
    WHEN POSITION('.' IN "key") > 0 THEN SPLIT_PART("key", '.', 2)
    WHEN POSITION('_' IN "key") > 0 THEN SPLIT_PART("key", '_', 2)
    ELSE "key"
  END,
  "valueJson" = CASE
    WHEN "value" IS NULL THEN jsonb_build_object()
    ELSE jsonb_build_object('value', "value")
  END,
  "valueSchemaJson" = jsonb_build_object(
    'type', 'object',
    'additionalProperties', true
  ),
  "publishedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP),
  "publishedBy" = 'migration';

ALTER TABLE "AppMeta"
  ALTER COLUMN "namespace" SET NOT NULL,
  ALTER COLUMN "valueJson" SET NOT NULL,
  ALTER COLUMN "valueSchemaJson" SET NOT NULL,
  ALTER COLUMN "publishedAt" SET NOT NULL,
  ALTER COLUMN "publishedBy" SET NOT NULL;

ALTER TABLE "AppMeta" DROP COLUMN "value";

CREATE UNIQUE INDEX "AppMeta_namespace_key_key" ON "AppMeta"("namespace", "key");
