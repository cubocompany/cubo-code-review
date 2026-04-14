import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveSkillDocuments } from '../src/review/resolve-skill-docs.js'

test('resolves internal plus explicit and fallback skills', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cubo-skills-'))
  mkdirSync(path.join(root, '.github', 'review'), { recursive: true })
  mkdirSync(path.join(root, 'src', 'feature'), { recursive: true })
  writeFileSync(path.join(root, '.github', 'review', 'SKILL.md'), '# repo skill')
  writeFileSync(path.join(root, 'src', 'feature', 'review.md'), '# feature skill')
  writeFileSync(path.join(root, 'custom-skill.md'), '# explicit skill')

  const docs = resolveSkillDocuments({
    repositoryRoot: root,
    changedFiles: [{ path: 'src/feature/file.ts', status: 'modified', patch: '@@' }],
    explicitSkillPath: 'custom-skill.md'
  })

  assert.equal(docs[0].source, 'internal')
  assert.equal(docs.some((doc) => doc.path.endsWith('custom-skill.md')), true)
  assert.equal(docs.some((doc) => doc.path.endsWith(path.join('.github', 'review', 'SKILL.md'))), true)
  assert.equal(docs.some((doc) => doc.path.endsWith(path.join('src', 'feature', 'review.md'))), true)
})

test('throws when explicit skill file is missing', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cubo-skills-missing-'))
  assert.throws(() => resolveSkillDocuments({
    repositoryRoot: root,
    changedFiles: [],
    explicitSkillPath: 'missing.md'
  }), /Required skill file was not found/)
})
