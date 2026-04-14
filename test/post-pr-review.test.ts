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
    findings: [
      { category: 'nitpick', path: 'src/app.ts', body: 'Rename this helper.' }
    ]
  }, [
    { path: 'src/app.ts', body: '**nitpick:** Rename this helper.', subject_type: 'file' }
  ])

  assert.match(body, /Revisei o PR e deixei alguns comentários para consideração\./)
  assert.match(body, /\*\*File-level findings:\*\*/)
  assert.match(body, /`src\/app\.ts`/)
})

test('uses direct summary when changes are requested', () => {
  const body = buildReviewBody({
    summary: 'Long descriptive summary that should not be shown.',
    verdict: 'request_changes',
    findings: [
      { category: 'issue', path: 'src/app.ts', body: 'Guard the null case.' }
    ]
  }, [])

  assert.equal(body, 'Revisei o PR e deixei comentários que precisam de atenção.')
})
