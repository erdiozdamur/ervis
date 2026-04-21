import type { ProfileActivityLevel, ProfileGoalType } from '@prisma/client';
import { PROFILE_CALCULATOR_VERSION } from '@/lib/profile/constants';
import type { DailyTargets } from '@/types/profile';
import type { ProfileFormInput } from '@/lib/profile/validation';

const activityMultiplierMap: Record<ProfileActivityLevel, { multiplier: number; label: string }> = {
  SEDENTARY: { multiplier: 1.2, label: 'Çoğunlukla masa başı günler' },
  LIGHT: { multiplier: 1.375, label: 'Hafta içinde hafif aktivite' },
  MODERATE: { multiplier: 1.55, label: 'Haftalık orta düzey aktivite' },
  ACTIVE: { multiplier: 1.725, label: 'Haftalık çok aktif rutin' },
  VERY_ACTIVE: { multiplier: 1.9, label: 'Yoğun antrenman veya çok aktif yaşam' },
};

const goalAdjustmentMap: Record<ProfileGoalType, { multiplier: number; label: string }> = {
  LOSE_FAT: { multiplier: 0.85, label: 'Yağ kaybı için kontrollü kalori açığı' },
  MAINTAIN: { multiplier: 1, label: 'Kilo koruma odaklı başlangıç' },
  GAIN_MUSCLE: { multiplier: 1.1, label: 'Kas kazanımı için kontrollü kalori fazlası' },
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

function getCalorieFloor(input: ProfileFormInput) {
  if (input.goalType !== 'LOSE_FAT') return 0;
  return input.sex === 'MALE' ? 1500 : 1200;
}

export function calculateDailyTargets(input: ProfileFormInput): DailyTargets {
  const bmrCalories = calculateBmr(input);
  const activity = activityMultiplierMap[input.activityLevel];
  const goal = goalAdjustmentMap[input.goalType];
  const maintenanceCalories = bmrCalories * activity.multiplier;
  const adjustedCalories = maintenanceCalories * goal.multiplier;
  const calorieFloor = getCalorieFloor(input);
  const dailyCalories = roundToNearest25(Math.max(adjustedCalories, calorieFloor));

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
      proteinBasisLabel: `Kg başına ${proteinFactor.toFixed(1)} g protein`,
    },
  };
}
