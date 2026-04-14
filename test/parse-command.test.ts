import test from 'node:test'
import assert from 'node:assert/strict'
import { isCuboReviewCommand, parseExecutionTarget, parseReviewCommand } from '../src/command/parse-command.js'

test('accepts cubo command only on the first line', () => {
  assert.equal(isCuboReviewCommand('/cubo-review target=openrouter/anthropic/claude-sonnet-4.6'), true)
  assert.equal(isCuboReviewCommand('notes\n/cubo-review target=openrouter/anthropic/claude-sonnet-4.6'), false)
})

test('parses command key value pairs', () => {
  const command = parseReviewCommand('/cubo-review target=openrouter/anthropic/claude-sonnet-4.6 skill=.github/review/SKILL.md focus=security')
  assert.equal(command.skill, '.github/review/SKILL.md')
  assert.equal(command.focus, 'security')
  assert.deepEqual(command.target, {
    backend: 'openrouter',
    provider: 'anthropic',
    model: 'claude-sonnet-4.6'
  })
})

test('rejects malformed target', () => {
  assert.throws(() => parseExecutionTarget('openrouter/anthropic'), /Expected format backend\/provider\/model/)
})

test('rejects unsupported backend', () => {
  assert.throws(() => parseExecutionTarget('foo/anthropic/model'), /Unsupported backend/)
})

test('supports a custom configured review command', () => {
  assert.equal(isCuboReviewCommand('/uqbar-review target=openrouter/anthropic/claude-sonnet-4.6', '/uqbar-review'), true)
  assert.equal(isCuboReviewCommand('/cubo-review target=openrouter/anthropic/claude-sonnet-4.6', '/uqbar-review'), false)

  const command = parseReviewCommand(
    '/uqbar-review target=openrouter/anthropic/claude-sonnet-4.6 skill=.github/review/SKILL.md focus=security',
    '/uqbar-review'
  )

  assert.equal(command.skill, '.github/review/SKILL.md')
  assert.equal(command.focus, 'security')
  assert.deepEqual(command.target, {
    backend: 'openrouter',
    provider: 'anthropic',
    model: 'claude-sonnet-4.6'
  })
})

test('uses /cubo-review by default when no custom command is provided', () => {
  const command = parseReviewCommand('/cubo-review target=openrouter/anthropic/claude-sonnet-4.6')
  assert.deepEqual(command.target, {
    backend: 'openrouter',
    provider: 'anthropic',
    model: 'claude-sonnet-4.6'
  })
})
