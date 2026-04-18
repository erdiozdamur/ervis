CREATE TYPE "ProfileSex" AS ENUM ('FEMALE', 'MALE');
CREATE TYPE "ProfileGoalType" AS ENUM ('LOSE_FAT', 'MAINTAIN', 'GAIN_MUSCLE');
CREATE TYPE "ProfileActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

ALTER TABLE "user_profiles"
ADD COLUMN "age" INTEGER,
ADD COLUMN "sex" "ProfileSex",
ADD COLUMN "heightCm" INTEGER,
ADD COLUMN "weightKg" DECIMAL(5,2),
ADD COLUMN "goalType" "ProfileGoalType",
ADD COLUMN "activityLevel" "ProfileActivityLevel",
ADD COLUMN "trainingFrequencyPerWeek" INTEGER,
ADD COLUMN "macroProteinGrams" INTEGER,
ADD COLUMN "macroCarbGrams" INTEGER,
ADD COLUMN "macroFatGrams" INTEGER,
ADD COLUMN "calculatorVersion" VARCHAR(32),
ADD COLUMN "targetCalculatedAt" TIMESTAMP(3);
