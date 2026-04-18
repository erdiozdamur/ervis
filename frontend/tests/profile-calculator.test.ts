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

  assert.equal(result.calculatorVersion, 'mifflin-v1');
  assert.equal(result.dailyCalories % 25, 0);
  assert.ok(result.dailyCalories > 0);
  assert.ok(result.proteinGrams > 0);
  assert.ok(result.carbGrams >= 0);
  assert.ok(result.fatGrams >= 40);
});
