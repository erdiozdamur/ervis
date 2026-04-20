import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStructuredPayload } from '@/services/meal-analysis/openai-stage1-image-itemizer';
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
  assert.equal(result.items[0]?.displayName, 'Izgara tavuk');
  assert.equal(result.items[1]?.displayName, 'Pilav');
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

  assert.equal(result.canonicalName, 'Mercimek corbasi');
  assert.equal(result.servingSummary, '1 kase');
  assert.equal(result.macros.calories, 180);
  assert.equal(result.gramsEstimate, 260);
});
