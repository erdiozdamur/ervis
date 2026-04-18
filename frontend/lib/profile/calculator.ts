import type { ProfileActivityLevel, ProfileGoalType } from '@prisma/client';
import { PROFILE_CALCULATOR_VERSION } from '@/lib/profile/constants';
import type { DailyTargets } from '@/types/profile';
import type { ProfileFormInput } from '@/lib/profile/validation';

const activityMultiplierMap: Record<ProfileActivityLevel, { multiplier: number; label: string }> = {
  SEDENTARY: { multiplier: 1.2, label: 'Mostly seated days' },
  LIGHT: { multiplier: 1.35, label: 'Light activity through the week' },
  MODERATE: { multiplier: 1.5, label: 'Moderate weekly activity' },
  ACTIVE: { multiplier: 1.7, label: 'Very active weekly routine' },
  VERY_ACTIVE: { multiplier: 1.9, label: 'Highly active training or lifestyle' },
};

const goalAdjustmentMap: Record<ProfileGoalType, { multiplier: number; label: string }> = {
  LOSE_FAT: { multiplier: 0.85, label: 'A modest calorie reduction for fat loss' },
  MAINTAIN: { multiplier: 1, label: 'A maintenance-style starting point' },
  GAIN_MUSCLE: { multiplier: 1.1, label: 'A modest calorie surplus for muscle gain' },
};

function roundToNearest25(value: number) {
  return Math.round(value / 25) * 25;
}

function getProteinFactor(goalType: ProfileGoalType, trainingFrequencyPerWeek: number) {
  if (goalType === 'LOSE_FAT') {
    return trainingFrequencyPerWeek >= 3 ? 2 : 1.8;
  }

  if (goalType === 'GAIN_MUSCLE') {
    return trainingFrequencyPerWeek >= 4 ? 2.1 : 2;
  }

  return trainingFrequencyPerWeek >= 3 ? 1.7 : 1.6;
}

function getFatRatio(goalType: ProfileGoalType) {
  if (goalType === 'LOSE_FAT') return 0.3;
  if (goalType === 'GAIN_MUSCLE') return 0.25;
  return 0.28;
}

function calculateBmr(input: ProfileFormInput) {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === 'MALE' ? base + 5 : base - 161;
}

export function calculateDailyTargets(input: ProfileFormInput): DailyTargets {
  const bmrCalories = calculateBmr(input);
  const activity = activityMultiplierMap[input.activityLevel];
  const goal = goalAdjustmentMap[input.goalType];
  const maintenanceCalories = bmrCalories * activity.multiplier;
  const dailyCalories = roundToNearest25(maintenanceCalories * goal.multiplier);

  const proteinFactor = getProteinFactor(input.goalType, input.trainingFrequencyPerWeek);
  const proteinGrams = Math.round(input.weightKg * proteinFactor);
  const fatGrams = Math.max(40, Math.round((dailyCalories * getFatRatio(input.goalType)) / 9));
  const carbCalories = Math.max(0, dailyCalories - proteinGrams * 4 - fatGrams * 9);
  const carbGrams = Math.round(carbCalories / 4);

  return {
    dailyCalories,
    proteinGrams,
    carbGrams,
    fatGrams,
    calculatorVersion: PROFILE_CALCULATOR_VERSION,
    explanation: {
      bmrCalories: Math.round(bmrCalories),
      maintenanceCalories: roundToNearest25(maintenanceCalories),
      goalAdjustmentLabel: goal.label,
      activityLabel: activity.label,
      proteinBasisLabel: `${proteinFactor.toFixed(1)} g protein per kg body weight`,
    },
  };
}
