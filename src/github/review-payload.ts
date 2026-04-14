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
    const body = buildFindingBody(finding, anchor)
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

function buildFindingBody(finding: ModelFinding, anchor: ResolvedAnchor): string {
  const prefix = `${finding.category.toUpperCase()}:`
  const docs = finding.documentationUrl ? `\n\nOfficial documentation: ${finding.documentationUrl}` : ''

  let suggestion = ''
  if (finding.suggestedCode && finding.line && anchor.type === 'line') {
    const lineContent = anchor.content.replace(/^[+ ]/, '')
    const codeNormalized = finding.suggestedCode.trim()
    const lineNormalized = lineContent.trim()
    if (codeNormalized !== lineNormalized) {
      suggestion = `\n\n\`\`\`suggestion\n${finding.suggestedCode}\n\`\`\``
    }
  }

  return `${prefix} ${finding.body}${docs}${suggestion}`
}

type ResolvedAnchor =
  | { type: 'line', position: number, content: string }
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

  return { type: 'line', position: info.position, content: info.content }
}

type PatchLineInfo = { position: number, content: string }

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
      lineInfo.set(currentRightLine, { position, content: rawLine })
      currentRightLine += 1
    } else {
      lineInfo.set(currentRightLine, { position, content: rawLine })
      currentRightLine += 1
    }
  }

  return lineInfo
}
