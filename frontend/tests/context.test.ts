import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInheritedContextFromLists } from '@/server/services/context';

test('employee context includes inherited and direct buckets', () => {
  const resolved = resolveInheritedContextFromLists({
    ownerType: 'EMPLOYEE',
    org: [{ id: 'o1' } as never],
    team: [{ id: 't1' } as never],
    employee: [{ id: 'e1' } as never],
  });

  assert.equal(resolved.inheritedFromOrganization.length, 1);
  assert.equal(resolved.inheritedFromTeam.length, 1);
  assert.equal(resolved.direct.length, 1);
});
