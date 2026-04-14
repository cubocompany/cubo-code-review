import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInlineReviewComments, determineReviewEvent } from '../src/github/review-payload.js'
import { parseModelResponse } from '../src/review/parse-model-response.js'

test('builds grouped inline review comments with categories and suggestions', () => {
  const result = parseModelResponse(JSON.stringify({
    summary: 'Please address the blocking issue before merge.',
    findings: [
      {
        category: 'issue',
        path: 'src/app.ts',
        line: 12,
        body: 'The null case is not handled.',
        suggestedCode: 'if (!value) return null;'
      },
      {
        category: 'nitpick',
        path: 'README.md',
        body: 'This can be clarified for new contributors.'
      }
    ]
  }))

  const comments = buildInlineReviewComments([
    { path: 'src/app.ts', status: 'modified', patch: '@@ -1,0 +12,1 @@\n+added line' },
    { path: 'README.md', status: 'modified', patch: '@@' }
  ], result.findings)

  assert.equal(comments.length, 2)
  assert.match(comments[0].body, /^ISSUE:/)
  assert.match(comments[0].body, /```suggestion/)
  assert.equal(comments[0].line, 12)
  assert.equal(comments[1].subject_type, 'file')
  assert.equal(determineReviewEvent(result), 'REQUEST_CHANGES')
})
