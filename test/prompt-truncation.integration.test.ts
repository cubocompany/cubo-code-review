import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReviewPromptWithMetadata } from '../src/review/build-review-prompt.js'

test('buildReviewPromptWithMetadata truncates and omits files when the PR is large', () => {
  const result = buildReviewPromptWithMetadata({
    owner: 'acme',
    repo: 'demo',
    pullNumber: 1,
    title: 'Large PR',
    body: 'desc',
    headSha: 'head',
    baseSha: 'base',
    diff: '',
    reviewLanguage: 'en-US',
    target: { backend: 'openrouter', provider: 'anthropic', model: 'claude-sonnet-4.6' },
    skillDocuments: [{ path: 'src/internal/SKILL.md', content: 'Always be precise.', source: 'internal' }],
    files: Array.from({ length: 12 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      status: 'modified',
      patch: '+'.repeat(8000)
    }))
  })

  assert.ok(result.includedFiles.length > 0)
  assert.ok(result.truncatedFiles.length > 0)
  assert.ok(result.omittedFiles.length > 0)
  assert.match(result.prompt, /Files omitted due to size budget:/)
})
