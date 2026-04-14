import test from 'node:test'
import assert from 'node:assert/strict'
import { parseReviewCommand } from '../src/command/parse-command.js'

test('returns readable malformed target error', () => {
  assert.throws(
    () => parseReviewCommand('/cubo-review target=openrouter/anthropic'),
    /Invalid target/
  )
})
