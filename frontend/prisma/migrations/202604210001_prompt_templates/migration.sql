-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "systemInstructions" TEXT NOT NULL,
    "userTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_key_version_locale_key" ON "prompt_templates"("key", "version", "locale");

-- CreateIndex
CREATE INDEX "prompt_templates_key_locale_isActive_idx" ON "prompt_templates"("key", "locale", "isActive");

-- CreateIndex
CREATE INDEX "prompt_templates_createdAt_idx" ON "prompt_templates"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_active_per_key_locale" ON "prompt_templates"("key", "locale") WHERE "isActive" = true;

-- AddForeignKey
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
