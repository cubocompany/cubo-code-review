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
    { path: 'src/app.ts', status: 'modified', patch: '@@ -11,0 +12,1 @@\n+const nextValue = value' },
    { path: 'README.md', status: 'modified', patch: '@@' }
  ], result.findings)

  assert.equal(comments.length, 2)
  assert.match(comments[0].body, /^\*\*issue(?: \(blocking\))?:\*\*/) 
  assert.match(comments[0].body, /```suggestion/)
  assert.equal(comments[0].position, 1)
  assert.equal(comments[1].subject_type, 'file')
  assert.equal(determineReviewEvent(result), 'REQUEST_CHANGES')
})

test('keeps inline comment but omits suggestion block for context lines', () => {
  const result = parseModelResponse(JSON.stringify({
    summary: 'Looks mostly good.',
    findings: [
      {
        category: 'suggestion',
        path: 'src/app.ts',
        line: 12,
        body: 'Consider simplifying this expression.',
        suggestedCode: 'const nextValue = simplify(value)'
      }
    ]
  }))

  const comments = buildInlineReviewComments([
    { path: 'src/app.ts', status: 'modified', patch: '@@ -12,2 +12,3 @@\n const currentValue = value\n+const createdValue = create(value)\n const nextValue = currentValue' }
  ], result.findings)

  assert.equal(comments.length, 1)
  assert.equal(comments[0].position, 1)
  assert.doesNotMatch(comments[0].body, /```suggestion/)
  assert.match(comments[0].body, /^\*\*suggestion:\*\*/)
})

test('falls back to file-level comment when target line is semantically incompatible', () => {
  const result = parseModelResponse(JSON.stringify({
    summary: 'Please review one mismatch.',
    findings: [
      {
        category: 'suggestion',
        path: 'src/RegisterRedirect.tsx',
        line: 146,
        body: 'The ownerId expression can be simplified to avoid the redundant String conversion.',
        suggestedCode: "ownerId={confirmedData?.owner?.id ? String(confirmedData.owner.id) : ''}"
      }
    ]
  }))

  const comments = buildInlineReviewComments([
    {
      path: 'src/RegisterRedirect.tsx',
      status: 'modified',
      patch: '@@ -145,2 +145,3 @@\n+  {shouldShowMismatchGuidance && (\n+    <Box sx={{ px: 2, pt: 2 }}>\n       <Alert severity="warning">'
    }
  ], result.findings)

  assert.equal(comments.length, 1)
  assert.equal(comments[0].subject_type, 'file')
  assert.equal(comments[0].position, undefined)
  assert.doesNotMatch(comments[0].body, /```suggestion/)
})
