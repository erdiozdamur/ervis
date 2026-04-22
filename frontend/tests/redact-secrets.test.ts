import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets } from '@/lib/security/redact-secrets';

test('redactSecrets masks secret-like object keys recursively', () => {
  const input = {
    provider: 'openai',
    apiKey: 'sk-test',
    nested: {
      clientSecret: 'top-secret',
      promptVersion: 'meal-intake-v2',
    },
    list: [{ accessToken: 'abc' }, { value: 12 }],
  };

  const result = redactSecrets(input);

  assert.equal(result.provider, 'openai');
  assert.equal(result.apiKey, '[REDACTED]');
  assert.equal(result.nested.clientSecret, '[REDACTED]');
  assert.equal(result.nested.promptVersion, 'meal-intake-v2');
  assert.equal(result.list[0]?.accessToken, '[REDACTED]');
  assert.equal(result.list[1]?.value, 12);
});
