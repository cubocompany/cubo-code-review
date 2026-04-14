import { ExecutionTarget } from '../command/types.js'

export type PullRequestFile = {
  path: string
  status: string
  patch?: string
}

export type SkillDocument = {
  path: string
  content: string
  source: 'internal' | 'explicit' | 'default' | 'fallback'
}

export type ReviewContext = {
  owner: string
  repo: string
  pullNumber: number
  title: string
  body: string
  headSha: string
  baseSha: string
  diff: string
  files: PullRequestFile[]
  skillDocuments: SkillDocument[]
  reviewLanguage: string
  focus?: string
  target: ExecutionTarget
}

export type ModelFindingCategory = 'issue' | 'question' | 'nitpick' | 'refactor' | 'suggestion'

export type ModelFinding = {
  category: ModelFindingCategory
  path: string
  line?: number
  startLine?: number
  body: string
  suggestedCode?: string
  documentationUrl?: string
}

export type ModelReviewResult = {
  summary: string
  verdict?: 'comment' | 'request_changes'
  findings: ModelFinding[]
  parserWarnings?: string[]
}

export type PromptBuildResult = {
  prompt: string
  includedFiles: string[]
  omittedFiles: string[]
  truncatedFiles: string[]
}
