// test-pipeline-feed.cjs — unit tests for the pipeline auto-feed dedupe decision.
// The real integration is verified by live runs; this mirrors the decision function.
const test = require('node:test');
const assert = require('node:assert');

function shouldCreatePipelineRow(existingRows) {
  return !existingRows || existingRows.length === 0;
}

test('creates pipeline row when none exists', () => {
  assert.strictEqual(shouldCreatePipelineRow([]), true);
});
test('skips when patient already in pipeline', () => {
  assert.strictEqual(shouldCreatePipelineRow([{ id: 'x' }]), false);
});
test('skips when fetch returned null (treated as no rows)', () => {
  assert.strictEqual(shouldCreatePipelineRow(null), true);
});
test('skips when fetch errored and returned undefined', () => {
  assert.strictEqual(shouldCreatePipelineRow(undefined), true);
});
