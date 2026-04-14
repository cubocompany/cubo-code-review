import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReviewBody } from '../src/github/post-pr-review.js'

test('uses approval summary fallback when verdict is approve without findings', () => {
  const body = buildReviewBody({
    summary: 'Long summary that should not be shown.',
    verdict: 'approve',
    findings: []
  }, [])

  assert.equal(body, 'Pull Request aprovado sem mudanças necessárias.')
})

test('appends file-level findings to the review body', () => {
  const body = buildReviewBody({
    summary: 'Please review the file-level findings.',
    verdict: 'comment',
    findings: []
  }, [
    { path: 'src/app.ts', body: 'NITPICK: Rename this helper.', subject_type: 'file' }
  ])

  assert.match(body, /Please review the file-level findings\./)
  assert.match(body, /\*\*File-level findings:\*\*/)
  assert.match(body, /`src\/app\.ts`/)
})
