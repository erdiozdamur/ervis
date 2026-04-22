import assert from 'node:assert/strict';
import test from 'node:test';
import { appMetaRegistry, validateAppMetaKey, validateAppMetaRecord } from '@/lib/app-meta';

test('app meta registry only exposes namespaced keys', () => {
  assert.deepEqual(Object.keys(appMetaRegistry).sort(), [
    'ai.analysisPromptVersion',
    'ai.mealModel',
    'ai.provider',
    'app.name',
    'app.supportEmail',
    'feature.mealDraftReview',
  ]);
});

test('validateAppMetaKey accepts known key and rejects unknown key', () => {
  assert.equal(validateAppMetaKey('app.name'), true);
  assert.equal(validateAppMetaKey('legacy_cache_key'), false);
});

test('validateAppMetaRecord enforces zod value + version metadata', () => {
  const result = validateAppMetaRecord(
    'feature.mealDraftReview',
    { enabled: true, rolloutPercentage: 25 },
    { version: 3, publishedAt: '2026-04-21T00:00:00.000Z', publishedBy: 'feature-team' },
  );

  assert.equal(result.namespace, 'feature');
  assert.equal(result.key, 'mealDraftReview');
  assert.equal(result.versioning.version, 3);
  assert.equal(result.versioning.publishedBy, 'feature-team');
});

test('validateAppMetaRecord throws when payload does not match schema', () => {
  assert.throws(() =>
    validateAppMetaRecord(
      'ai.mealModel',
      { model: 'gpt-4.1-mini', temperature: 4 },
      { version: 1, publishedAt: '2026-04-21T00:00:00.000Z', publishedBy: 'ai-team' },
    ),
  );
});
