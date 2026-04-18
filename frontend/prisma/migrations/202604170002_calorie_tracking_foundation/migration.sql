ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "Account" RENAME TO "auth_accounts";
ALTER TABLE "Session" RENAME TO "auth_sessions";
ALTER TABLE "VerificationToken" RENAME TO "auth_verification_tokens";

ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";
ALTER TABLE "auth_accounts" RENAME CONSTRAINT "Account_pkey" TO "auth_accounts_pkey";
ALTER TABLE "auth_accounts" RENAME CONSTRAINT "Account_userId_fkey" TO "auth_accounts_userId_fkey";
ALTER TABLE "auth_sessions" RENAME CONSTRAINT "Session_pkey" TO "auth_sessions_pkey";
ALTER TABLE "auth_sessions" RENAME CONSTRAINT "Session_userId_fkey" TO "auth_sessions_userId_fkey";

ALTER INDEX "User_email_key" RENAME TO "users_email_key";
ALTER INDEX "Account_provider_providerAccountId_key" RENAME TO "auth_accounts_provider_providerAccountId_key";
ALTER INDEX "Session_sessionToken_key" RENAME TO "auth_sessions_sessionToken_key";
ALTER INDEX "VerificationToken_token_key" RENAME TO "auth_verification_tokens_token_key";
ALTER INDEX "VerificationToken_identifier_token_key" RENAME TO "auth_verification_tokens_identifier_token_key";

CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

CREATE TYPE "MealStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ARCHIVED');
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER');
CREATE TYPE "MealInputAssetType" AS ENUM ('IMAGE', 'TEXT', 'BARCODE');
CREATE TYPE "MealAnalysisStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "SharedNutritionSource" AS ENUM ('OFFICIAL_DATASET', 'USER_CONFIRMED', 'AI_ESTIMATE');

CREATE TABLE "user_profiles" (
    "userId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "dailyCalorieGoal" INTEGER,
    "preferredLanguage" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "meals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MealStatus" NOT NULL DEFAULT 'DRAFT',
    "mealType" "MealType" NOT NULL DEFAULT 'OTHER',
    "title" VARCHAR(120),
    "notes" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "mealDate" DATE NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "food_catalog_entries" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "canonicalName" VARCHAR(191) NOT NULL,
    "brandName" VARCHAR(191),
    "source" "SharedNutritionSource" NOT NULL DEFAULT 'OFFICIAL_DATASET',
    "externalSourceName" VARCHAR(64),
    "externalSourceId" VARCHAR(128),
    "defaultServingAmount" DECIMAL(10,2),
    "defaultServingUnit" VARCHAR(32),
    "calories" DECIMAL(10,2),
    "proteinGrams" DECIMAL(10,2),
    "carbGrams" DECIMAL(10,2),
    "fatGrams" DECIMAL(10,2),
    "fiberGrams" DECIMAL(10,2),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_catalog_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_cache_entries" (
    "id" TEXT NOT NULL,
    "cacheKey" VARCHAR(191) NOT NULL,
    "normalizedQueryText" VARCHAR(191) NOT NULL,
    "source" "SharedNutritionSource" NOT NULL DEFAULT 'AI_ESTIMATE',
    "provider" VARCHAR(64),
    "normalizedFoodEntryId" TEXT,
    "servingAmount" DECIMAL(10,2),
    "servingUnit" VARCHAR(32),
    "calories" DECIMAL(10,2),
    "proteinGrams" DECIMAL(10,2),
    "carbGrams" DECIMAL(10,2),
    "fatGrams" DECIMAL(10,2),
    "fiberGrams" DECIMAL(10,2),
    "payloadJson" JSONB,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrition_cache_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meal_items" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "displayName" VARCHAR(160) NOT NULL,
    "quantityAmount" DECIMAL(10,2),
    "quantityUnit" VARCHAR(32),
    "gramsEstimate" DECIMAL(10,2),
    "calories" DECIMAL(10,2),
    "proteinGrams" DECIMAL(10,2),
    "carbGrams" DECIMAL(10,2),
    "fatGrams" DECIMAL(10,2),
    "fiberGrams" DECIMAL(10,2),
    "normalizedFoodEntryId" TEXT,
    "nutritionCacheEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meal_input_assets" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetType" "MealInputAssetType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "textContent" TEXT,
    "storageKey" VARCHAR(255),
    "mimeType" VARCHAR(128),
    "sha256" VARCHAR(128),
    "fileSizeBytes" INTEGER,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_input_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meal_analysis_runs" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MealAnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" VARCHAR(64) NOT NULL,
    "model" VARCHAR(128) NOT NULL,
    "promptVersion" VARCHAR(64),
    "requestFingerprint" VARCHAR(128) NOT NULL,
    "requestJson" JSONB,
    "responseJson" JSONB,
    "draftResultJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_analysis_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_catalog_entries_slug_key" ON "food_catalog_entries"("slug");
CREATE UNIQUE INDEX "nutrition_cache_entries_cacheKey_key" ON "nutrition_cache_entries"("cacheKey");
CREATE INDEX "meals_userId_mealDate_consumedAt_idx" ON "meals"("userId", "mealDate", "consumedAt");
CREATE INDEX "meals_userId_status_createdAt_idx" ON "meals"("userId", "status", "createdAt");
CREATE INDEX "meal_items_mealId_sortOrder_idx" ON "meal_items"("mealId", "sortOrder");
CREATE INDEX "meal_items_normalizedFoodEntryId_idx" ON "meal_items"("normalizedFoodEntryId");
CREATE INDEX "meal_items_nutritionCacheEntryId_idx" ON "meal_items"("nutritionCacheEntryId");
CREATE INDEX "meal_input_assets_mealId_sortOrder_idx" ON "meal_input_assets"("mealId", "sortOrder");
CREATE INDEX "meal_input_assets_userId_createdAt_idx" ON "meal_input_assets"("userId", "createdAt");
CREATE INDEX "meal_input_assets_sha256_idx" ON "meal_input_assets"("sha256");
CREATE INDEX "meal_analysis_runs_mealId_createdAt_idx" ON "meal_analysis_runs"("mealId", "createdAt");
CREATE INDEX "meal_analysis_runs_userId_createdAt_idx" ON "meal_analysis_runs"("userId", "createdAt");
CREATE INDEX "meal_analysis_runs_status_createdAt_idx" ON "meal_analysis_runs"("status", "createdAt");
CREATE INDEX "meal_analysis_runs_requestFingerprint_idx" ON "meal_analysis_runs"("requestFingerprint");
CREATE INDEX "food_catalog_entries_canonicalName_idx" ON "food_catalog_entries"("canonicalName");
CREATE INDEX "food_catalog_entries_externalSourceName_externalSourceId_idx" ON "food_catalog_entries"("externalSourceName", "externalSourceId");
CREATE INDEX "nutrition_cache_entries_normalizedQueryText_idx" ON "nutrition_cache_entries"("normalizedQueryText");
CREATE INDEX "nutrition_cache_entries_normalizedFoodEntryId_idx" ON "nutrition_cache_entries"("normalizedFoodEntryId");
CREATE INDEX "nutrition_cache_entries_expiresAt_idx" ON "nutrition_cache_entries"("expiresAt");

ALTER TABLE "user_profiles"
ADD CONSTRAINT "user_profiles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meals"
ADD CONSTRAINT "meals_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nutrition_cache_entries"
ADD CONSTRAINT "nutrition_cache_entries_normalizedFoodEntryId_fkey"
FOREIGN KEY ("normalizedFoodEntryId") REFERENCES "food_catalog_entries"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meal_items"
ADD CONSTRAINT "meal_items_mealId_fkey"
FOREIGN KEY ("mealId") REFERENCES "meals"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_items"
ADD CONSTRAINT "meal_items_normalizedFoodEntryId_fkey"
FOREIGN KEY ("normalizedFoodEntryId") REFERENCES "food_catalog_entries"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meal_items"
ADD CONSTRAINT "meal_items_nutritionCacheEntryId_fkey"
FOREIGN KEY ("nutritionCacheEntryId") REFERENCES "nutrition_cache_entries"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meal_input_assets"
ADD CONSTRAINT "meal_input_assets_mealId_fkey"
FOREIGN KEY ("mealId") REFERENCES "meals"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_input_assets"
ADD CONSTRAINT "meal_input_assets_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_analysis_runs"
ADD CONSTRAINT "meal_analysis_runs_mealId_fkey"
FOREIGN KEY ("mealId") REFERENCES "meals"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meal_analysis_runs"
ADD CONSTRAINT "meal_analysis_runs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
