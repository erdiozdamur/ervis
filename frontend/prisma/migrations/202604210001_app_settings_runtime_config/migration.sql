CREATE TABLE "app_settings" (
    "key" VARCHAR(191) NOT NULL,
    "valueJson" JSONB NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "scope" VARCHAR(64) NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" VARCHAR(191),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "app_settings_scope_type_idx" ON "app_settings"("scope", "type");
