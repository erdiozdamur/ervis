import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { PROFILE_TIME_ZONE } from '@/lib/profile/constants';
import { calculateDailyTargets } from '@/lib/profile/calculator';
import type { ProfileFormInput } from '@/lib/profile/validation';
import type { ProfileSnapshot } from '@/types/profile';

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value ? value.toNumber() : undefined;
}

export async function getUserProfileSnapshot(userId: string): Promise<ProfileSnapshot> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return {
      values: null,
      targets: null,
    };
  }

  const values =
    profile.age != null &&
    profile.sex != null &&
    profile.heightCm != null &&
    profile.weightKg != null &&
    profile.goalType != null &&
    profile.activityLevel != null &&
    profile.trainingFrequencyPerWeek != null
      ? {
          age: profile.age,
          sex: profile.sex,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg.toNumber(),
          goalType: profile.goalType,
          activityLevel: profile.activityLevel,
          trainingFrequencyPerWeek: profile.trainingFrequencyPerWeek,
        }
      : null;

  const targets =
    profile.dailyCalorieGoal != null &&
    profile.macroProteinGrams != null &&
    profile.macroCarbGrams != null &&
    profile.macroFatGrams != null &&
    profile.calculatorVersion != null &&
    values
      ? calculateDailyTargets(values)
      : null;

  return {
    values,
    targets: targets
      ? {
          ...targets,
          dailyCalories: profile.dailyCalorieGoal ?? targets.dailyCalories,
          proteinGrams: profile.macroProteinGrams ?? targets.proteinGrams,
          carbGrams: profile.macroCarbGrams ?? targets.carbGrams,
          fatGrams: profile.macroFatGrams ?? targets.fatGrams,
          calculatorVersion: profile.calculatorVersion ?? targets.calculatorVersion,
        }
      : null,
  };
}

export async function upsertUserProfileWithTargets(userId: string, input: ProfileFormInput): Promise<ProfileSnapshot> {
  const targets = calculateDailyTargets(input);

  await prisma.userProfile.upsert({
    where: { userId },
    update: {
      timeZone: PROFILE_TIME_ZONE,
      age: input.age,
      sex: input.sex,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      goalType: input.goalType,
      activityLevel: input.activityLevel,
      trainingFrequencyPerWeek: input.trainingFrequencyPerWeek,
      dailyCalorieGoal: targets.dailyCalories,
      macroProteinGrams: targets.proteinGrams,
      macroCarbGrams: targets.carbGrams,
      macroFatGrams: targets.fatGrams,
      calculatorVersion: targets.calculatorVersion,
      targetCalculatedAt: new Date(),
    },
    create: {
      userId,
      timeZone: PROFILE_TIME_ZONE,
      age: input.age,
      sex: input.sex,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      goalType: input.goalType,
      activityLevel: input.activityLevel,
      trainingFrequencyPerWeek: input.trainingFrequencyPerWeek,
      dailyCalorieGoal: targets.dailyCalories,
      macroProteinGrams: targets.proteinGrams,
      macroCarbGrams: targets.carbGrams,
      macroFatGrams: targets.fatGrams,
      calculatorVersion: targets.calculatorVersion,
      targetCalculatedAt: new Date(),
    },
  });

  return {
    values: {
      age: input.age,
      sex: input.sex,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      goalType: input.goalType,
      activityLevel: input.activityLevel,
      trainingFrequencyPerWeek: input.trainingFrequencyPerWeek,
    },
    targets,
  };
}
