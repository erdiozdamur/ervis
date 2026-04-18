import assert from 'node:assert/strict';
import test from 'node:test';
import { mealDraftResultUpdateSchema } from '@/lib/meals/draft-result-validation';
import { sumDraftItemMacros } from '@/services/meals/draft-result-service';

test('mealDraftResultUpdateSchema accepts editable draft payloads', () => {
  const parsed = mealDraftResultUpdateSchema.parse({
    titleSuggestion: 'Chicken wrap lunch',
    mealTypeSuggestion: 'LUNCH',
    items: [
      {
        id: 'item_1',
        displayName: 'Chicken wrap',
        quantityText: '1 wrap',
        gramsEstimate: '185',
        macros: {
          calories: '420',
          proteinGrams: '28',
          carbGrams: '34',
          fatGrams: '17',
          fiberGrams: '4',
        },
      },
    ],
  });

  assert.equal(parsed.items[0]?.macros.calories, 420);
  assert.equal(parsed.items[0]?.quantityText, '1 wrap');
  assert.equal(parsed.items[0]?.gramsEstimate, 185);
});

test('sumDraftItemMacros recomputes totals from edited items', () => {
  const totals = sumDraftItemMacros([
    {
      macros: {
        calories: 420,
        proteinGrams: 28,
        carbGrams: 34,
        fatGrams: 17,
        fiberGrams: 4,
      },
    },
    {
      macros: {
        calories: 105,
        proteinGrams: 2,
        carbGrams: 21,
        fatGrams: 1,
        fiberGrams: 3,
      },
    },
  ]);

  assert.deepEqual(totals, {
    calories: 525,
    proteinGrams: 30,
    carbGrams: 55,
    fatGrams: 18,
    fiberGrams: 7,
  });
});
