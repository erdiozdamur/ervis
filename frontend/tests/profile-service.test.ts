import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '@/db/prisma';
import { PROFILE_TIME_ZONE } from '@/lib/profile/constants';
import { calculateDailyTargets } from '@/lib/profile/calculator';
import { getUserProfileSnapshot, upsertUserProfileWithTargets } from '@/services/profile/profile-service';

test('getUserProfileSnapshot returns null targets when profile data is incomplete', async () => {
  const profileDelegate = prisma.userProfile as unknown as {
    findUnique: (args: { where: { userId: string } }) => Promise<unknown>;
  };
  const originalFindUnique = profileDelegate.findUnique;

  profileDelegate.findUnique = async () => ({
    userId: 'user_1',
    age: 31,
    sex: 'MALE',
    heightCm: 178,
    weightKg: { toNumber: () => 82.4 },
    goalType: null,
    activityLevel: 'MODERATE',
    trainingFrequencyPerWeek: 3,
    dailyCalorieGoal: null,
    macroProteinGrams: null,
    macroCarbGrams: null,
    macroFatGrams: null,
    calculatorVersion: null,
  });

  try {
    const snapshot = await getUserProfileSnapshot('user_1');

    assert.equal(snapshot.values, null);
    assert.equal(snapshot.targets, null);
  } finally {
    profileDelegate.findUnique = originalFindUnique;
  }
});

test('upsertUserProfileWithTargets stores calculated targets and returns the new snapshot', async () => {
  const profileDelegate = prisma.userProfile as unknown as {
    upsert: (args: Record<string, unknown>) => Promise<unknown>;
  };
  const originalUpsert = profileDelegate.upsert;
  let capturedTimeZone: string | null = null;
  let capturedDailyCalories: number | null = null;
  let capturedProtein: number | null = null;
  let capturedCarbs: number | null = null;
  let capturedFat: number | null = null;
  let capturedCalculatorVersion: string | null = null;
  let capturedCalculatedAt: Date | null = null;

  profileDelegate.upsert = async (args) => {
    const updateData = (args as { update: Record<string, unknown> }).update;
    capturedTimeZone = updateData.timeZone as string;
    capturedDailyCalories = updateData.dailyCalorieGoal as number;
    capturedProtein = updateData.macroProteinGrams as number;
    capturedCarbs = updateData.macroCarbGrams as number;
    capturedFat = updateData.macroFatGrams as number;
    capturedCalculatorVersion = updateData.calculatorVersion as string;
    capturedCalculatedAt = updateData.targetCalculatedAt as Date;
    return {};
  };

  const input = {
    age: 29,
    sex: 'FEMALE' as const,
    heightCm: 167,
    weightKg: 61.5,
    goalType: 'MAINTAIN' as const,
    activityLevel: 'LIGHT' as const,
    trainingFrequencyPerWeek: 2,
  };

  try {
    const snapshot = await upsertUserProfileWithTargets('user_2', input);
    const expectedTargets = calculateDailyTargets(input);
    if (
      capturedTimeZone == null ||
      capturedDailyCalories == null ||
      capturedProtein == null ||
      capturedCarbs == null ||
      capturedFat == null ||
      capturedCalculatorVersion == null ||
      capturedCalculatedAt == null
    ) {
      throw new Error('Expected prisma.userProfile.upsert to be called.');
    }

    assert.deepEqual(snapshot.values, input);
    assert.deepEqual(snapshot.targets, expectedTargets);
    assert.equal(capturedTimeZone, PROFILE_TIME_ZONE);
    assert.equal(capturedDailyCalories, expectedTargets.dailyCalories);
    assert.equal(capturedProtein, expectedTargets.proteinGrams);
    assert.equal(capturedCarbs, expectedTargets.carbGrams);
    assert.equal(capturedFat, expectedTargets.fatGrams);
    assert.equal(capturedCalculatorVersion, expectedTargets.calculatorVersion);
  } finally {
    profileDelegate.upsert = originalUpsert;
  }
});
