import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateHeuristicMacros, parseTextIntoFoodSegments, suggestMealTypeFromConsumedAt } from '@/services/meal-analysis/heuristics';

test('parseTextIntoFoodSegments keeps quantity hints from text assets', () => {
  const segments = parseTextIntoFoodSegments('2 eggs, chicken wrap and coffee');

  assert.equal(segments.length, 3);
  assert.equal(segments[0]?.displayName, 'Eggs');
  assert.equal(segments[0]?.quantityMultiplier, 2);
  assert.equal(segments[1]?.normalizedQuery, 'chicken wrap');
});

test('parseTextIntoFoodSegments understands Turkish portion phrases', () => {
  const segments = parseTextIntoFoodSegments('1 tabak kuru fasulye, 1 kase mercimek çorbası ve yarım porsiyon pilav');

  assert.equal(segments.length, 3);
  assert.equal(segments[0]?.displayName, 'Kuru fasulye');
  assert.equal(segments[0]?.quantityText, '1 tabak');
  assert.equal(segments[1]?.displayName, 'Mercimek çorbası');
  assert.equal(segments[1]?.quantityText, '1 kase');
  assert.equal(segments[2]?.quantityText, 'yarım porsiyon');
  assert.equal(segments[2]?.quantityMultiplier, 0.5);
});

test('estimateHeuristicMacros returns known nutrition estimates for common foods', () => {
  const result = estimateHeuristicMacros('egg', 2);

  assert.equal(result.macros.calories, 156);
  assert.equal(result.macros.proteinGrams, 12);
  assert.ok(result.confidence > 0.5);
});

test('suggestMealTypeFromConsumedAt maps dayparts into product meal types', () => {
  assert.equal(suggestMealTypeFromConsumedAt(new Date(Date.UTC(2026, 3, 17, 6, 0))), 'BREAKFAST');
  assert.equal(suggestMealTypeFromConsumedAt(new Date(Date.UTC(2026, 3, 17, 11, 0))), 'LUNCH');
  assert.equal(suggestMealTypeFromConsumedAt(new Date(Date.UTC(2026, 3, 17, 17, 0))), 'DINNER');
  assert.equal(suggestMealTypeFromConsumedAt(new Date(Date.UTC(2026, 3, 17, 22, 0))), 'SNACK');
});
