import type { ProfileActivityLevel, ProfileGoalType, ProfileSex } from '@prisma/client';

export const PROFILE_TIME_ZONE = 'Europe/Istanbul';
export const PROFILE_CALCULATOR_VERSION = 'mifflin-v1';

export const sexOptions: Array<{ value: ProfileSex; label: string; description: string }> = [
  { value: 'FEMALE', label: 'Female', description: 'Used only for a simple energy estimate formula.' },
  { value: 'MALE', label: 'Male', description: 'Used only for a simple energy estimate formula.' },
];

export const goalTypeOptions: Array<{ value: ProfileGoalType; label: string; description: string }> = [
  { value: 'LOSE_FAT', label: 'Lose fat', description: 'Sets a modest calorie reduction and keeps protein supportive.' },
  { value: 'MAINTAIN', label: 'Maintain', description: 'A steady starting target for weight maintenance.' },
  { value: 'GAIN_MUSCLE', label: 'Build muscle', description: 'Adds a modest calorie surplus with supportive macros.' },
];

export const activityLevelOptions: Array<{ value: ProfileActivityLevel; label: string; description: string }> = [
  { value: 'SEDENTARY', label: 'Mostly seated', description: 'Little planned movement most days.' },
  { value: 'LIGHT', label: 'Lightly active', description: 'Some walking and light activity through the week.' },
  { value: 'MODERATE', label: 'Moderately active', description: 'Regular movement or training most weeks.' },
  { value: 'ACTIVE', label: 'Very active', description: 'Frequent movement, training, or physically active days.' },
  { value: 'VERY_ACTIVE', label: 'Highly active', description: 'Hard training or a very active daily routine.' },
];

export const trainingFrequencyOptions = [
  { value: 0, label: '0', description: 'No training sessions most weeks.' },
  { value: 2, label: '1-2', description: 'A light training rhythm.' },
  { value: 4, label: '3-4', description: 'A regular training rhythm.' },
  { value: 6, label: '5+', description: 'Frequent training every week.' },
] as const;
