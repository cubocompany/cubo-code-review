import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInlineReviewComments } from '../src/github/review-payload.js'

test('buildInlineReviewComments falls back to file comments when a line is not present in the patch', () => {
  const comments = buildInlineReviewComments([
    {
      path: 'src/demo.ts',
      status: 'modified',
      patch: '@@ -1,2 +1,3 @@\n const a = 1\n+const b = 2\n const c = 3'
    }
  ], [
    {
      category: 'issue',
      path: 'src/demo.ts',
      line: 99,
      body: 'This line is not part of the diff.'
    }
  ])

  assert.equal(comments.length, 1)
  assert.equal(comments[0].subject_type, 'file')
  assert.equal(comments[0].position, undefined)
})
