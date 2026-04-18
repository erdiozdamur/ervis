import type { ProfileActivityLevel, ProfileGoalType, ProfileSex } from '@prisma/client';

export type ProfileFormValues = {
  age: number;
  sex: ProfileSex;
  heightCm: number;
  weightKg: number;
  goalType: ProfileGoalType;
  activityLevel: ProfileActivityLevel;
  trainingFrequencyPerWeek: number;
};

export type ProfileFieldErrors = Partial<Record<keyof ProfileFormValues, string>>;

export type DailyTargets = {
  dailyCalories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  calculatorVersion: string;
  explanation: {
    bmrCalories: number;
    maintenanceCalories: number;
    goalAdjustmentLabel: string;
    activityLabel: string;
    proteinBasisLabel: string;
  };
};

export type ProfileSnapshot = {
  values: Partial<ProfileFormValues> | null;
  targets: DailyTargets | null;
};

export type ProfileUpdateResult =
  | {
      ok: true;
      profile: ProfileSnapshot;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: ProfileFieldErrors;
    };
