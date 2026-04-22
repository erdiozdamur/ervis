export function createMutationHeaders(csrfToken: string) {
  return {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
    'x-idempotency-key': crypto.randomUUID(),
  };
}

export function createMutationHeadersWithoutJson(csrfToken: string) {
  return {
    'x-csrf-token': csrfToken,
    'x-idempotency-key': crypto.randomUUID(),
  };
}
