import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PullRequestFile, SkillDocument } from './types.js'

const INTERNAL_SKILL_PATH = process.env.GITHUB_ACTION_PATH
  ? path.resolve(process.env.GITHUB_ACTION_PATH, 'dist/bundle/SKILL.md')
  : path.resolve(process.cwd(), 'src/internal/SKILL.md')
const FALLBACK_FILENAMES = ['SKILL.md', 'review.md', 'AGENTS.md', 'CLAUDE.md']

export type ResolveSkillOptions = {
  repositoryRoot: string
  changedFiles: PullRequestFile[]
  explicitSkillPath?: string
  defaultSkillPath?: string
}

export function resolveSkillDocuments(options: ResolveSkillOptions): SkillDocument[] {
  const resolved: SkillDocument[] = []
  const seen = new Set<string>()

  addDocument(resolved, seen, INTERNAL_SKILL_PATH, 'internal', true)

  if (options.explicitSkillPath) {
    const absolute = path.resolve(options.repositoryRoot, options.explicitSkillPath)
    addDocument(resolved, seen, absolute, 'explicit', true)
  }

  if (options.defaultSkillPath) {
    const absolute = path.resolve(options.repositoryRoot, options.defaultSkillPath)
    addDocument(resolved, seen, absolute, 'default', false)
  }

  for (const fallbackPath of discoverFallbacks(options.repositoryRoot, options.changedFiles)) {
    addDocument(resolved, seen, fallbackPath, 'fallback', false)
  }

  return resolved
}

function discoverFallbacks(repositoryRoot: string, changedFiles: PullRequestFile[]): string[] {
  const candidates: string[] = []
  for (const filename of FALLBACK_FILENAMES) {
    candidates.push(path.join(repositoryRoot, filename))
    candidates.push(path.join(repositoryRoot, '.github', 'review', filename))
  }

  for (const file of changedFiles) {
    const directories = getDirectoriesToRoot(path.dirname(file.path))
    for (const directory of directories) {
      for (const filename of FALLBACK_FILENAMES) {
        candidates.push(path.join(repositoryRoot, directory, filename))
      }
    }
  }

  return dedupe(candidates.filter((candidate) => existsSync(candidate)))
}

function getDirectoriesToRoot(directory: string): string[] {
  if (!directory || directory === '.' || directory === path.sep) {
    return ['.']
  }
  const result: string[] = []
  let current = directory
  while (current && current !== '.' && current !== path.sep) {
    result.push(current)
    const next = path.dirname(current)
    if (next === current) break
    current = next
  }
  result.push('.')
  return result
}

function addDocument(list: SkillDocument[], seen: Set<string>, absolutePath: string, source: SkillDocument['source'], required: boolean): void {
  if (!existsSync(absolutePath)) {
    if (required) {
      throw new Error(`Required skill file was not found: ${absolutePath}`)
    }
    return
  }

  const normalized = path.normalize(absolutePath)
  if (seen.has(normalized)) {
    return
  }

  seen.add(normalized)
  list.push({
    path: normalized,
    content: readFileSync(normalized, 'utf8'),
    source
  })
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.map((item) => path.normalize(item)))]
}
