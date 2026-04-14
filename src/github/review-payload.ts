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

    const body = buildFindingBody(finding)
    const anchor = resolveAnchor(file, finding)
    if (anchor.type === 'file') {
      return [{ path: finding.path, body, subject_type: 'file' }]
    }

    return [{ path: finding.path, body, position: anchor.position }]
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

function resolveAnchor(file: PullRequestFile, finding: ModelFinding): { type: 'line', position: number } | { type: 'file' } {
  if (!finding.line || !file.patch) {
    return { type: 'file' }
  }

  const linePositions = getPatchLinePositions(file.patch)
  const position = linePositions.get(finding.line)
  if (position === undefined) {
    return { type: 'file' }
  }

  if (finding.startLine !== undefined) {
    for (let current = finding.startLine; current < finding.line; current += 1) {
      if (!linePositions.has(current)) {
        return { type: 'file' }
      }
    }
  }

  return { type: 'line', position }
}

function getPatchLinePositions(patch: string): Map<number, number> {
  const lineToPosition = new Map<number, number>()
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

    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      lineToPosition.set(currentRightLine, position)
      currentRightLine += 1
    } else if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      // deletion line — advances position but not the right-side line counter
    } else {
      currentRightLine += 1
    }
  }

  return lineToPosition
}
