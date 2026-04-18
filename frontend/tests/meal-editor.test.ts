import assert from 'node:assert/strict';
import test from 'node:test';
import { finalMealUpdateSchema } from '@/lib/meals/final-meal-validation';
import { buildMealItemCreateInputs } from '@/services/meals/meal-editor-service';

test('finalMealUpdateSchema accepts structured final meal item edits', () => {
  const parsed = finalMealUpdateSchema.parse({
    dayKey: '2026-04-17',
    title: 'Dinner',
    mealType: 'DINNER',
    consumedTime: '19:30',
    notes: 'Updated after dinner.',
    items: [
      {
        id: 'item_1',
        displayName: 'Beef steak',
        quantityAmount: '1',
        quantityUnit: 'porsiyon',
        gramsEstimate: '180',
        macros: {
          calories: '430',
          proteinGrams: '31',
          carbGrams: '18',
          fatGrams: '24',
          fiberGrams: '2',
        },
      },
    ],
  });

  assert.equal(parsed.items[0]?.gramsEstimate, 180);
  assert.equal(parsed.items[0]?.quantityAmount, 1);
  assert.equal(parsed.items[0]?.quantityUnit, 'porsiyon');
});

test('buildMealItemCreateInputs maps final meal edits into meal item rows', () => {
  const rows = buildMealItemCreateInputs('meal_1', [
    {
      id: 'item_1',
      displayName: 'Rice pilaf',
      quantityAmount: 1,
      quantityUnit: 'tabak',
      gramsEstimate: 220,
      macros: {
        calories: 320,
        proteinGrams: 7,
        carbGrams: 63,
        fatGrams: 4,
        fiberGrams: 2,
      },
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.mealId, 'meal_1');
  assert.equal(rows[0]?.quantityUnit, 'tabak');
  assert.equal(rows[0]?.gramsEstimate, 220);
  assert.equal(rows[0]?.normalizedFoodEntryId, null);
  assert.equal(rows[0]?.nutritionCacheEntryId, null);
});
