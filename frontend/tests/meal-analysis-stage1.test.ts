import assert from 'node:assert/strict';
import test from 'node:test';
import { DefaultMealStage1Estimator } from '@/services/meal-analysis/default-stage1-estimator';

test('stage 1 extracts separate items from an audio transcript', async () => {
  const estimator = new DefaultMealStage1Estimator();

  const result = await estimator.estimate({
    mealId: 'meal_1',
    userId: 'user_1',
    analysisRunId: 'run_1',
    consumedAt: new Date(Date.UTC(2026, 3, 17, 9, 0)),
    mealType: 'LUNCH',
    assets: [
      {
        id: 'asset_audio',
        assetType: 'AUDIO',
        source: 'recording',
        textContent: '1 bardak ayran ve yarım porsiyon tavuk pilav',
        mimeType: 'audio/webm',
        storageKey: 'user/day/audio/recording.webm',
        labelHint: null,
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(result.estimatedItems.length, 2);
  assert.equal(result.estimatedItems[0]?.quantityText, '1 bardak');
  assert.equal(result.estimatedItems[1]?.quantityMultiplier, 0.5);
  assert.equal(result.estimatedItems.every((item) => item.unresolved), false);
});

test('stage 1 creates a conservative photo draft item with a portion estimate', async () => {
  const estimator = new DefaultMealStage1Estimator();

  const result = await estimator.estimate({
    mealId: 'meal_2',
    userId: 'user_2',
    analysisRunId: 'run_2',
    consumedAt: new Date(Date.UTC(2026, 3, 17, 15, 0)),
    mealType: 'DINNER',
    assets: [
      {
        id: 'asset_image',
        assetType: 'IMAGE',
        source: 'camera',
        textContent: null,
        mimeType: 'image/jpeg',
        storageKey: 'user/day/images/camera.jpg',
        labelHint: 'mercimek-corbasi.jpg',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(result.estimatedItems.length, 1);
  assert.equal(result.estimatedItems[0]?.displayName, 'Mercimek corbasi');
  assert.equal(result.estimatedItems[0]?.quantityText, '1 kase');
  assert.equal(result.estimatedItems[0]?.unresolved, true);
});
