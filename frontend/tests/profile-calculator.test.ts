import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDailyTargets } from '@/lib/profile/calculator';

test('calculateDailyTargets returns rounded calorie and macro estimates', () => {
  const result = calculateDailyTargets({
    age: 30,
    sex: 'MALE',
    heightCm: 180,
    weightKg: 80,
    goalType: 'MAINTAIN',
    activityLevel: 'MODERATE',
    trainingFrequencyPerWeek: 3,
  });

  assert.equal(result.calculatorVersion, 'mifflin-v2');
  assert.equal(result.dailyCalories % 25, 0);
  assert.ok(result.dailyCalories > 0);
  assert.ok(result.proteinGrams > 0);
  assert.ok(result.carbGrams >= 0);
  assert.ok(result.fatGrams >= 40);
});

test('calculateDailyTargets applies a calorie floor for fat-loss plans', () => {
  const result = calculateDailyTargets({
    age: 80,
    sex: 'FEMALE',
    heightCm: 120,
    weightKg: 35,
    goalType: 'LOSE_FAT',
    activityLevel: 'SEDENTARY',
    trainingFrequencyPerWeek: 4,
  });

  assert.ok(result.dailyCalories >= 1200);
});
