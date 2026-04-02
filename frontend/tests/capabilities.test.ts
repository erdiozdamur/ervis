import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveCapabilitiesFromLists } from '@/server/services/capabilities';

test('effective capabilities include team defaults and employee direct overrides', () => {
  const result = resolveEffectiveCapabilitiesFromLists({
    includeTeamDefaults: true,
    teamDefault: [
      { key: 'route_task', label: 'Route Task', description: null },
      { key: 'summarize_text', label: 'Summarize Text', description: null },
    ],
    employee: [
      { key: 'summarize_text', label: 'Summarize Text', description: null },
      { key: 'write_analysis', label: 'Write Analysis', description: null },
    ],
  });

  assert.equal(result.length, 3);
  assert.ok(result.find((cap) => cap.key === 'route_task'));
  assert.ok(result.find((cap) => cap.key === 'write_analysis'));
});
