import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateCommission, isCardExpired } from '../src/lib/logic.js';

test('calculateCommission charges 0.40 when banks differ', () => {
  const result = calculateCommission('Banco Pichincha', 'Banco Guayaquil');
  assert.equal(result, 0.4);
});

test('calculateCommission charges 0 when banks are the same', () => {
  const result = calculateCommission('Banco Pichincha', 'Banco Pichincha');
  assert.equal(result, 0);
});

test('isCardExpired detects expired cards', () => {
  const expired = isCardExpired('01/22');
  const valid = isCardExpired('12/30');
  assert.equal(expired, true);
  assert.equal(valid, false);
});
