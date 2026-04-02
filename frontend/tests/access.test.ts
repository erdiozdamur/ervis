import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeOwnershipWhere, organizationOwnershipWhere, teamOwnershipWhere } from '@/server/auth/access';

test('ownership where clauses bind user ownership correctly', () => {
  assert.deepEqual(organizationOwnershipWhere('u1', 'o1'), { id: 'o1', ownerId: 'u1' });
  assert.deepEqual(teamOwnershipWhere('u1', 't1'), { id: 't1', organization: { ownerId: 'u1' } });
  assert.deepEqual(employeeOwnershipWhere('u1', 'e1'), { id: 'e1', organization: { ownerId: 'u1' } });
});
