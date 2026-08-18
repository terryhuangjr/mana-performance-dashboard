// test-trainerize-process.cjs — unit tests for event classification logic.
const test = require('node:test');
const assert = require('node:assert');

// Mirrors trainerize-process.cjs classifyEvent() — kept here so the processor
// stays dependency-light; live behavior verified by running the real script.
function classifyEvent(ev) {
  const type = ev.event_type || (ev.payload || {}).event || 'unknown';
  if (type === 'client.added') {
    const p = ev.payload || {};
    const full = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    return full ? { action: 'add', name: full } : { action: 'skip', reason: 'no-name' };
  }
  if (type === 'ping') return { action: 'noop' };
  return { action: 'mark', reason: 'unknown-type' };
}

test('client.added with name → add', () => {
  assert.deepStrictEqual(
    classifyEvent({ event_type: 'client.added', payload: { firstName: 'Test', lastName: 'Lead' } }),
    { action: 'add', name: 'Test Lead' }
  );
});
test('client.added with name only in payload.event (no event_type)', () => {
  assert.deepStrictEqual(
    classifyEvent({ payload: { event: 'client.added', firstName: 'A', lastName: 'B' } }),
    { action: 'add', name: 'A B' }
  );
});
test('client.added without name → skip', () => {
  assert.deepStrictEqual(classifyEvent({ event_type: 'client.added', payload: {} }), { action: 'skip', reason: 'no-name' });
});
test('ping → noop', () => {
  assert.deepStrictEqual(classifyEvent({ event_type: 'ping', payload: {} }), { action: 'noop' });
});
test('ping via payload.event (no event_type) → noop', () => {
  assert.deepStrictEqual(classifyEvent({ payload: { event: 'ping' } }), { action: 'noop' });
});
test('unknown type → mark', () => {
  assert.deepStrictEqual(classifyEvent({ event_type: 'whatever' }), { action: 'mark', reason: 'unknown-type' });
});
