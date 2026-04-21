import assert from 'node:assert/strict';
import test from 'node:test';
import { looksLikeSeparatedPlatterLabel, parseStructuredPayload } from '@/services/meal-analysis/openai-stage1-image-itemizer';
import { getDefaultAnalysisRules } from '@/services/meal-analysis/analysis-rule-repository';
import { parseStructuredNutritionPayload } from '@/services/meal-analysis/openai-stage2-nutrition-service';

test('stage 1 parser accepts top-level output_parsed payloads', () => {
  const result = parseStructuredPayload({
    output_parsed: {
      items: [
        {
          displayName: 'Izgara tavuk',
          quantityText: '1 porsiyon',
          quantityMultiplier: 1,
          confidence: 0.92,
          reasoning: 'Fotoğrafta ayrı bir protein öğesi olarak görünüyor.',
        },
        {
          displayName: 'Pilav',
          quantityText: '1 porsiyon',
          quantityMultiplier: 1,
          confidence: 0.87,
          reasoning: 'Ana yemeğin yanında ayrı bir karbonhidrat bileşeni görünüyor.',
        },
      ],
    },
  });

  assert.equal(result.items.length, 2);
  assert.equal(result.items[0]?.displayName, 'Tavuk göğsü');
  assert.equal(result.items[1]?.displayName, 'Pilav');
});

test('stage 1 parser localizes known English food names into Turkish', () => {
  const result = parseStructuredPayload({
    output_parsed: {
      items: [
        {
          displayName: 'Rice pilaf',
          quantityText: '1 plate',
          quantityMultiplier: 1,
          confidence: 0.8,
          reasoning: 'Detected from photo.',
        },
      ],
    },
  });

  assert.equal(result.items[0]?.displayName, 'Pilav');
});

test('stage 2 parser accepts structured content parts without output_text', () => {
  const result = parseStructuredNutritionPayload({
    output: [
      {
        content: [
          {
            type: 'output_json',
            json: {
              canonicalName: 'Mercimek corbasi',
              servingSummary: '1 kase',
              gramsEstimate: 260,
              confidence: 0.83,
              reasoning: 'Kase boyutuna gore tipik restoran porsiyonu tahmin edildi.',
              macros: {
                calories: 180,
                proteinGrams: 10,
                carbGrams: 24,
                fatGrams: 5,
                fiberGrams: 6,
              },
            },
          },
        ],
      },
    ],
  });

  assert.equal(result.canonicalName, 'Mercimek çorbası');
  assert.equal(result.servingSummary, '1 kase');
  assert.equal(result.macros.calories, 180);
  assert.equal(result.gramsEstimate, 260);
});

test('stage 1 detects platter-style umbrella labels that should be split again', () => {
  const rules = getDefaultAnalysisRules().stage1;
  assert.equal(looksLikeSeparatedPlatterLabel('Karışık Türk Mezesi Tabağı', rules), true);
  assert.equal(looksLikeSeparatedPlatterLabel('Kahvaltı tabağı', rules), true);
  assert.equal(looksLikeSeparatedPlatterLabel('Karnıyarık', rules), false);
});
