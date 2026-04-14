import test from 'node:test'
import assert from 'node:assert/strict'
import { safeParseModelResponse } from '../src/review/parse-model-response.js'

test('safeParseModelResponse returns a fallback summary instead of throwing', () => {
  const result = safeParseModelResponse('not-json-at-all')

  assert.equal(result.verdict, 'comment')
  assert.equal(result.findings.length, 0)
  assert.ok(result.summary.includes('could not be converted into structured inline findings'))
  assert.ok(result.parserWarnings?.[0]?.includes('valid JSON'))
})
