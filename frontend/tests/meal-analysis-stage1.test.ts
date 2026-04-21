import assert from 'node:assert/strict';
import test from 'node:test';
import { DefaultMealStage1Estimator } from '@/services/meal-analysis/default-stage1-estimator';
import { applyImageItemizationPostProcessing } from '@/services/meal-analysis/openai-stage1-image-itemizer';

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

test('stage 1 does not use generic image filenames as food names', async () => {
  const estimator = new DefaultMealStage1Estimator();

  const result = await estimator.estimate({
    mealId: 'meal_3',
    userId: 'user_3',
    analysisRunId: 'run_3',
    consumedAt: new Date(Date.UTC(2026, 3, 17, 15, 0)),
    mealType: 'DINNER',
    assets: [
      {
        id: 'asset_image',
        assetType: 'IMAGE',
        source: 'upload',
        textContent: null,
        mimeType: 'image/jpeg',
        storageKey: null,
        labelHint: 'images (1).jpeg',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(result.estimatedItems.length, 1);
  assert.equal(result.estimatedItems[0]?.displayName, 'Fotoğraftaki öğün');
  assert.equal(result.estimatedItems[0]?.quantityText, '1 tabak');
  assert.equal(result.estimatedItems[0]?.unresolved, true);
  assert.equal(result.warnings.some((warning) => warning.includes('tek öğelik inceleme taslağına indirildi')), true);
});

test('stage 1 falls back to a single unresolved upload item when image itemization throws', async () => {
  class ThrowingEstimator extends DefaultMealStage1Estimator {
    protected override async extractImageItems(_input: Parameters<DefaultMealStage1Estimator['extractImageItems']>[0]): Promise<never> {
      throw new Error('The stage 1 image itemizer request failed.');
    }
  }

  const estimator = new ThrowingEstimator();
  const result = await estimator.estimate({
    mealId: 'meal_4',
    userId: 'user_4',
    analysisRunId: 'run_4',
    consumedAt: new Date(Date.UTC(2026, 3, 17, 15, 0)),
    mealType: 'DINNER',
    assets: [
      {
        id: 'asset_upload',
        assetType: 'IMAGE',
        source: 'upload',
        textContent: null,
        mimeType: 'image/jpeg',
        storageKey: 'user/day/images/upload.jpg',
        labelHint: 'img_1042.jpg',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(result.estimatedItems.length, 1);
  assert.equal(result.estimatedItems[0]?.displayName, 'Fotoğraftaki öğün');
  assert.equal(result.estimatedItems[0]?.quantityText, '1 tabak');
  assert.equal(result.estimatedItems[0]?.reasoning.includes('inceleme taslağına indirildi'), true);
});

test('stage 1 treats IMG-style upload names as generic labels', async () => {
  const estimator = new DefaultMealStage1Estimator();

  const result = await estimator.estimate({
    mealId: 'meal_generic_img',
    userId: 'user_generic_img',
    analysisRunId: 'run_generic_img',
    consumedAt: new Date(Date.UTC(2026, 3, 17, 15, 0)),
    mealType: 'DINNER',
    assets: [
      {
        id: 'asset_generic_img',
        assetType: 'IMAGE',
        source: 'upload',
        textContent: null,
        mimeType: 'image/jpeg',
        storageKey: null,
        labelHint: 'IMG_1042.jpg',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(result.estimatedItems[0]?.displayName, 'Fotoğraftaki öğün');
});

test('stage 1 treats hash-like upload names as generic labels', async () => {
  const estimator = new DefaultMealStage1Estimator();

  const result = await estimator.estimate({
    mealId: 'meal_hash_name',
    userId: 'user_hash_name',
    analysisRunId: 'run_hash_name',
    consumedAt: new Date(Date.UTC(2026, 3, 17, 15, 0)),
    mealType: 'DINNER',
    assets: [
      {
        id: 'asset_hash_name',
        assetType: 'IMAGE',
        source: 'upload',
        textContent: null,
        mimeType: 'image/jpeg',
        storageKey: null,
        labelHint: 's-a0f05fb58b675a2b61327fa342b8e76bd6942f40.jpg',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(result.estimatedItems[0]?.displayName, 'Fotoğraftaki öğün');
});

test('stage 1 falls back to a single unresolved item when upload analysis cannot run live', async () => {
  class EmptyEstimator extends DefaultMealStage1Estimator {
    protected override async extractImageItems(_input: Parameters<DefaultMealStage1Estimator['extractImageItems']>[0]) {
      return {
        items: [],
        diagnostics: {
          responseId: null,
          responseStatus: null,
          structuredOutputFound: false,
          outputTextPreview: null,
          rawItemCount: 0,
          retryTriggered: false,
          retryUsed: false,
        },
      };
    }
  }

  const estimator = new EmptyEstimator();
  const result = await estimator.estimate({
    mealId: 'meal_5',
    userId: 'user_5',
    analysisRunId: 'run_5',
    consumedAt: new Date(Date.UTC(2026, 3, 17, 15, 0)),
    mealType: 'DINNER',
    assets: [
      {
        id: 'asset_upload',
        assetType: 'IMAGE',
        source: 'upload',
        textContent: null,
        mimeType: 'image/jpeg',
        storageKey: 'user/day/images/upload.jpg',
        labelHint: 'images (1).jpeg',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(result.estimatedItems.length, 1);
  assert.equal(result.estimatedItems[0]?.displayName, 'Fotoğraftaki öğün');
  assert.equal(result.warnings.some((warning) => warning.includes('tek öğelik inceleme taslağına indirildi')), true);
});

test('stage 1 keeps successful upload and camera itemization behavior identical', async () => {
  class StableEstimator extends DefaultMealStage1Estimator {
    protected override async extractImageItems(_input: Parameters<DefaultMealStage1Estimator['extractImageItems']>[0]) {
      return {
        items: [
          {
            displayName: 'Pilav',
            quantityText: '1 porsiyon',
            quantityMultiplier: 1,
            confidence: 0.9,
            reasoning: 'Model detected pilav as a separate item.',
          },
          {
            displayName: 'Tas kebabı',
            quantityText: '1 porsiyon',
            quantityMultiplier: 1,
            confidence: 0.88,
            reasoning: 'Model detected tas kebabı as a separate item.',
          },
        ],
        diagnostics: {
          responseId: null,
          responseStatus: null,
          structuredOutputFound: true,
          outputTextPreview: null,
          rawItemCount: 2,
          retryTriggered: false,
          retryUsed: false,
        },
      };
    }
  }

  const estimator = new StableEstimator();
  const buildResult = (source: 'upload' | 'camera') =>
    estimator.estimate({
      mealId: `meal_${source}`,
      userId: `user_${source}`,
      analysisRunId: `run_${source}`,
      consumedAt: new Date(Date.UTC(2026, 3, 17, 15, 0)),
      mealType: 'DINNER',
      assets: [
        {
          id: `asset_${source}`,
          assetType: 'IMAGE',
          source,
          textContent: null,
          mimeType: 'image/jpeg',
          storageKey: `user/day/images/${source}.jpg`,
          labelHint: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });

  const uploadResult = await buildResult('upload');
  const cameraResult = await buildResult('camera');

  assert.deepEqual(
    uploadResult.estimatedItems.map((item) => ({ displayName: item.displayName, quantityText: item.quantityText })),
    cameraResult.estimatedItems.map((item) => ({ displayName: item.displayName, quantityText: item.quantityText })),
  );
});

test('image itemization post-processing keeps separately served plate items split', () => {
  const result = applyImageItemizationPostProcessing(
    [
      { displayName: 'Pilav', quantityText: '1 porsiyon', quantityMultiplier: 1, confidence: 0.9, reasoning: 'Detected.' },
      { displayName: 'Tas kebabı', quantityText: '1 porsiyon', quantityMultiplier: 1, confidence: 0.88, reasoning: 'Detected.' },
      { displayName: 'Patates kızartması', quantityText: '1 porsiyon', quantityMultiplier: 1, confidence: 0.85, reasoning: 'Detected.' },
    ],
    null,
  );

  assert.equal(result.length, 3);
});

test('image itemization post-processing collapses composite dishes into one item', () => {
  const result = applyImageItemizationPostProcessing(
    [
      { displayName: 'Patlıcan', quantityText: '1 porsiyon', quantityMultiplier: 1, confidence: 0.82, reasoning: 'Detected.' },
      { displayName: 'Kıyma', quantityText: '1 porsiyon', quantityMultiplier: 1, confidence: 0.79, reasoning: 'Detected.' },
      { displayName: 'Domates sosu', quantityText: '1 porsiyon', quantityMultiplier: 1, confidence: 0.76, reasoning: 'Detected.' },
    ],
    'karniyarik.jpg',
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.displayName, 'Karnıyarık');
});
