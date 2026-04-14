import { ModelFinding, ModelReviewResult, PullRequestFile } from '../review/types.js'

export type InlineReviewComment = {
  path: string
  body: string
  position?: number
  subject_type?: 'file'
}

export function buildInlineReviewComments(files: PullRequestFile[], findings: ModelFinding[]): InlineReviewComment[] {
  const fileMap = new Map(files.map((file) => [file.path, file]))

  return findings.flatMap((finding): InlineReviewComment[] => {
    const file = fileMap.get(finding.path)
    if (!file) {
      return []
    }

    const anchor = resolveAnchor(file, finding)
    const compatibleAnchor = anchor.type === 'line' && !isSemanticallyCompatible(finding, anchor)
      ? { type: 'file' as const }
      : anchor
    const body = buildFindingBody(finding, compatibleAnchor)
    if (compatibleAnchor.type === 'file') {
      return [{ path: finding.path, body, subject_type: 'file' }]
    }

    return [{ path: finding.path, body, position: compatibleAnchor.position }]
  })
}

export function determineReviewEvent(result: ModelReviewResult): 'COMMENT' | 'REQUEST_CHANGES' {
  if (result.verdict === 'request_changes') {
    return 'REQUEST_CHANGES'
  }
  const hasIssue = result.findings.some((finding) => finding.category === 'issue')
  return hasIssue ? 'REQUEST_CHANGES' : 'COMMENT'
}

function buildFindingBody(finding: ModelFinding, anchor: ResolvedAnchor): string {
  const prefix = `${finding.category.toUpperCase()}:`
  const docs = finding.documentationUrl ? `\n\nOfficial documentation: ${finding.documentationUrl}` : ''

  let suggestion = ''
  if (finding.suggestedCode && finding.line && anchor.type === 'line' && anchor.isAddedLine) {
    const lineContent = anchor.content.replace(/^[+ ]/, '')
    const codeNormalized = finding.suggestedCode.trim()
    const lineNormalized = lineContent.trim()
    if (codeNormalized !== lineNormalized) {
      suggestion = `\n\n\`\`\`suggestion\n${finding.suggestedCode}\n\`\`\``
    }
  }

  return `${prefix} ${finding.body}${docs}${suggestion}`
}

function isSemanticallyCompatible(finding: ModelFinding, anchor: Extract<ResolvedAnchor, { type: 'line' }>): boolean {
  const referenceTokens = getReferenceTokens(finding, anchor)
  if (referenceTokens.length === 0) {
    return true
  }

  const lineTokens = new Set(extractIdentifierTokens(anchor.content.replace(/^[+ ]/, '')))
  return referenceTokens.some((token) => lineTokens.has(token))
}

function getReferenceTokens(finding: ModelFinding, anchor: Extract<ResolvedAnchor, { type: 'line' }>): string[] {
  const tokens = new Set<string>()

  if (anchor.isAddedLine) {
    for (const token of extractIdentifierTokens(finding.suggestedCode ?? '')) {
      tokens.add(token)
    }
  }

  for (const token of extractBodyCodeTokens(finding.body)) {
    tokens.add(token)
  }

  return [...tokens]
}

function extractIdentifierTokens(input: string): string[] {
  return [...input.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)]
    .map((match) => match[0].toLowerCase())
    .filter((token) => token.length >= 3 && !IGNORED_IDENTIFIER_TOKENS.has(token))
}

function extractBodyCodeTokens(input: string): string[] {
  const explicitCodeTokens = [
    ...input.matchAll(/`([^`]+)`/g),
    ...input.matchAll(/\b(?:[A-Za-z_][A-Za-z0-9_]*\.)+[A-Za-z_][A-Za-z0-9_]*\b/g),
    ...input.matchAll(/\b[A-Za-z_]*[A-Z][A-Za-z0-9_]*\b/g)
  ]

  return explicitCodeTokens.flatMap((match) => extractIdentifierTokens(match[1] ?? match[0]))
}

const IGNORED_IDENTIFIER_TOKENS = new Set([
  'const', 'let', 'var', 'return', 'true', 'false', 'null', 'undefined', 'this', 'that', 'with', 'from', 'into',
  'when', 'only', 'should', 'consider', 'using', 'avoid', 'make', 'sure', 'does', 'line', 'code',
  'expression', 'logic', 'state'
])

type ResolvedAnchor =
  | { type: 'line', position: number, content: string, isAddedLine: boolean }
  | { type: 'file' }

function resolveAnchor(file: PullRequestFile, finding: ModelFinding): ResolvedAnchor {
  if (!finding.line || !file.patch) {
    return { type: 'file' }
  }

  const patchLines = getPatchLineInfo(file.patch)
  const info = patchLines.get(finding.line)
  if (info === undefined) {
    return { type: 'file' }
  }

  if (finding.startLine !== undefined) {
    for (let current = finding.startLine; current < finding.line; current += 1) {
      if (!patchLines.has(current)) {
        return { type: 'file' }
      }
    }
  }

  return { type: 'line', position: info.position, content: info.content, isAddedLine: info.isAddedLine }
}

type PatchLineInfo = { position: number, content: string, isAddedLine: boolean }

function getPatchLineInfo(patch: string): Map<number, PatchLineInfo> {
  const lineInfo = new Map<number, PatchLineInfo>()
  let currentRightLine = 0
  let position = 0

  for (const rawLine of patch.split('\n')) {
    if (rawLine.startsWith('\\')) continue

    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(rawLine)
    if (header) {
      currentRightLine = Number(header[1])
      position += 1
      continue
    }

    if (position === 0) continue

    position += 1

    if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      continue
    }

    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      lineInfo.set(currentRightLine, { position, content: rawLine, isAddedLine: true })
      currentRightLine += 1
    } else {
      lineInfo.set(currentRightLine, { position, content: rawLine, isAddedLine: false })
      currentRightLine += 1
    }
  }

  return lineInfo
}
