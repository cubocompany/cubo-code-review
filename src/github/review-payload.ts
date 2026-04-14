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

    const body = buildFindingBody(finding)
    const anchor = resolveAnchor(file, finding)
    if (anchor.type === 'file') {
      return [{ path: finding.path, body, subject_type: 'file' }]
    }

    return [{
      path: finding.path,
      body,
      line: anchor.line,
      side: 'RIGHT',
      ...(anchor.startLine ? { start_line: anchor.startLine, start_side: 'RIGHT' } : {})
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

function buildFindingBody(finding: ModelFinding): string {
  const prefix = `${finding.category.toUpperCase()}:`
  const docs = finding.documentationUrl ? `\n\nOfficial documentation: ${finding.documentationUrl}` : ''
  const suggestion = finding.suggestedCode && finding.line
    ? `\n\n\`\`\`suggestion\n${finding.suggestedCode}\n\`\`\``
    : ''

  return `${prefix} ${finding.body}${docs}${suggestion}`
}

function resolveAnchor(file: PullRequestFile, finding: ModelFinding): { type: 'line', line: number, startLine?: number } | { type: 'file' } {
  if (!finding.line || !file.patch) {
    return { type: 'file' }
  }

  const addedLines = getAddedLinesFromPatch(file.patch)
  if (!addedLines.has(finding.line)) {
    return { type: 'file' }
  }

  if (finding.startLine !== undefined) {
    for (let current = finding.startLine; current <= finding.line; current += 1) {
      if (!addedLines.has(current)) {
        return { type: 'file' }
      }
    }
  }

  return { type: 'line', line: finding.line, startLine: finding.startLine }
}

function getAddedLinesFromPatch(patch: string): Set<number> {
  const addedLines = new Set<number>()
  let currentRightLine = 0

  for (const rawLine of patch.split('\n')) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(rawLine)
    if (header) {
      currentRightLine = Number(header[1])
      continue
    }

    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      addedLines.add(currentRightLine)
      currentRightLine += 1
      continue
    }

    if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      continue
    }

    currentRightLine += 1
  }

  return addedLines
}
