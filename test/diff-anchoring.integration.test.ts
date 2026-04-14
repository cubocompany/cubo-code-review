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
  assert.equal(comments[0].line, undefined)
})

test('buildInlineReviewComments anchors to context lines visible in the diff', () => {
  const comments = buildInlineReviewComments([
    {
      path: 'src/demo.ts',
      status: 'modified',
      patch: '@@ -1,3 +1,4 @@\n const a = 1\n+const b = 2\n const c = 3\n const d = 4'
    }
  ], [
    {
      category: 'nitpick',
      path: 'src/demo.ts',
      line: 1,
      body: 'Consider renaming this variable.'
    }
  ])

  assert.equal(comments.length, 1)
  assert.equal(comments[0].line, 1)
  assert.equal(comments[0].side, 'RIGHT')
  assert.equal(comments[0].subject_type, undefined)
})

test('buildInlineReviewComments anchors replacement-hunk feedback to the added interface line', () => {
  const comments = buildInlineReviewComments([
    {
      path: 'src/form.tsx',
      status: 'modified',
      patch: '@@ -41,4 +45,3 @@\n-export function EmailConfirmationForm({\n-  email,\n-  userType,\n-}: {\n+interface EmailConfirmationFormProps {\n email: string;'
    }
  ], [
    {
      category: 'nitpick',
      path: 'src/form.tsx',
      line: 45,
      body: 'Considere alinhar a definição do tipo com o padrão usado nos outros componentes.'
    }
  ])

  assert.equal(comments.length, 1)
  assert.equal(comments[0].line, 45)
  assert.equal(comments[0].side, 'RIGHT')
  assert.equal(comments[0].subject_type, undefined)
})
