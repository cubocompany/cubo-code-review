import { ModelFinding, ModelReviewResult, PullRequestFile } from '../review/types.js'

export type InlineReviewComment = {
  path: string
  body: string
  line?: number
  start_line?: number
  side?: 'RIGHT'
  start_side?: 'RIGHT'
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
    const compatibleAnchor = anchor.type === 'line'
      ? resolveCompatibleAnchor(file, finding, anchor)
      : anchor
    const body = buildFindingBody(finding, compatibleAnchor)
    if (compatibleAnchor.type === 'file') {
      return [{ path: finding.path, body, subject_type: 'file' }]
    }

    return [{
      path: finding.path,
      body,
      line: compatibleAnchor.line,
      side: 'RIGHT',
      ...(compatibleAnchor.startLine ? { start_line: compatibleAnchor.startLine, start_side: 'RIGHT' } : {})
    }]
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
  const prefix = buildConventionalPrefix(finding)
  const normalizedBody = normalizeCommentBody(finding.body)
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

  return `${prefix} ${normalizedBody}${docs}${suggestion}`
}

function buildConventionalPrefix(finding: ModelFinding): string {
  switch (finding.category) {
    case 'issue':
      return '**issue (blocking):**'
    case 'refactor':
      return '**suggestion:**'
    default:
      return `**${finding.category}:**`
  }
}

function normalizeCommentBody(body: string): string {
  return body
    .replace(/^\s*\*\*[a-z]+(?: \([^)]*\))?:\*\*\s*/i, '')
    .replace(/^\s*[a-z]+(?: \([^)]*\))?:\s*/i, '')
    .trim()
}

function resolveCompatibleAnchor(
  file: PullRequestFile,
  finding: ModelFinding,
  anchor: Extract<ResolvedAnchor, { type: 'line' }>
): ResolvedAnchor {
  if (isSemanticallyCompatible(finding, anchor)) {
    return anchor
  }

  const nearby = findNearbyCompatibleAnchor(file, finding)
  return nearby ?? { type: 'file' }
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
    ...input.matchAll(/\b[A-Za-z_]+[A-Z][A-Za-z0-9_]*\b/g)
  ]

  return explicitCodeTokens.flatMap((match) => extractIdentifierTokens(match[1] ?? match[0]))
}

const IGNORED_IDENTIFIER_TOKENS = new Set([
  'const', 'let', 'var', 'return', 'true', 'false', 'null', 'undefined', 'this', 'that', 'with', 'from', 'into',
  'when', 'only', 'should', 'consider', 'using', 'avoid', 'make', 'sure', 'does', 'line', 'code',
  'expression', 'logic', 'state'
])

type ResolvedAnchor =
  | { type: 'line', line: number, startLine?: number, content: string, isAddedLine: boolean, hunkId: number }
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

  return { type: 'line', line: finding.line, startLine: finding.startLine, content: info.content, isAddedLine: info.isAddedLine, hunkId: info.hunkId }
}

function findNearbyCompatibleAnchor(
  file: PullRequestFile,
  finding: ModelFinding
): Extract<ResolvedAnchor, { type: 'line' }> | undefined {
  if (!finding.line || !file.patch) {
    return undefined
  }

  const patchLines = getPatchLineInfo(file.patch)
  const original = patchLines.get(finding.line)
  const candidates = [...patchLines.entries()]
    .filter(([line, info]) => {
      if (Math.abs(line - finding.line!) > 2) return false
      if (original && info.hunkId !== original.hunkId) return false
      if (finding.suggestedCode && !info.isAddedLine) return false
      return true
    })
    .sort((a, b) => {
      const distance = Math.abs(a[0] - finding.line!) - Math.abs(b[0] - finding.line!)
      if (distance !== 0) return distance
      if (finding.suggestedCode) {
        return Number(b[1].isAddedLine) - Number(a[1].isAddedLine)
      }
      return 0
    })

  for (const [line, info] of candidates) {
    const candidate: Extract<ResolvedAnchor, { type: 'line' }> = {
      type: 'line',
      line,
      content: info.content,
      isAddedLine: info.isAddedLine,
      hunkId: info.hunkId
    }
    if (isSemanticallyCompatible(finding, candidate)) {
      return candidate
    }
  }

  return undefined
}

type PatchLineInfo = { content: string, isAddedLine: boolean, hunkId: number }

function getPatchLineInfo(patch: string): Map<number, PatchLineInfo> {
  const lineInfo = new Map<number, PatchLineInfo>()
  let currentRightLine = 0
  let inHunk = false
  let hunkId = -1

  for (const rawLine of patch.split('\n')) {
    if (rawLine.startsWith('\\')) continue

    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(rawLine)
    if (header) {
      currentRightLine = Number(header[1])
      inHunk = true
      hunkId += 1
      continue
    }

    if (!inHunk) continue

    if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      continue
    }

    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      lineInfo.set(currentRightLine, { content: rawLine, isAddedLine: true, hunkId })
      currentRightLine += 1
    } else {
      lineInfo.set(currentRightLine, { content: rawLine, isAddedLine: false, hunkId })
      currentRightLine += 1
    }
  }

  return lineInfo
}
