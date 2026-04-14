import { ModelFindingCategory, ModelReviewResult } from './types.js'

const ALLOWED_CATEGORIES: ModelFindingCategory[] = ['issue', 'question', 'nitpick', 'refactor', 'suggestion']

export function parseModelResponse(raw: string): ModelReviewResult {
  const trimmed = raw.trim()
  const withoutFences = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(withoutFences)
  } catch {
    throw new Error('Model response was not valid JSON.')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Model response must be a JSON object.')
  }

  const obj = parsed as Record<string, unknown>
  const summary = getString(obj.summary, 'summary')
  const findingsRaw = obj.findings
  if (!Array.isArray(findingsRaw)) {
    throw new Error('Model response must contain a findings array.')
  }

  const findings = findingsRaw.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Finding at index ${index} must be an object.`)
    }
    const finding = item as Record<string, unknown>
    const category = getString(finding.category, `findings[${index}].category`) as ModelFindingCategory
    if (!ALLOWED_CATEGORIES.includes(category)) {
      throw new Error(`Finding at index ${index} contains unsupported category "${category}".`)
    }

    const path = getString(finding.path, `findings[${index}].path`)
    const body = getString(finding.body, `findings[${index}].body`)
    const line = finding.line === undefined ? undefined : getNumber(finding.line, `findings[${index}].line`)
    const startLine = finding.startLine === undefined ? undefined : getNumber(finding.startLine, `findings[${index}].startLine`)
    if (line !== undefined && startLine !== undefined && startLine > line) {
      throw new Error(`Finding at index ${index} has startLine greater than line.`)
    }

    const documentationUrl = finding.documentationUrl === undefined
      ? undefined
      : getOfficialDocsUrl(finding.documentationUrl, `findings[${index}].documentationUrl`)

    const suggestedCodeRaw = finding.suggestedCode
    const suggestedCode = suggestedCodeRaw === undefined || suggestedCodeRaw === null || suggestedCodeRaw === ''
      ? undefined
      : getString(suggestedCodeRaw, `findings[${index}].suggestedCode`)

    return {
      category,
      path,
      body,
      line,
      startLine,
      suggestedCode,
      documentationUrl
    }
  })

  const verdict = obj.verdict
  if (verdict !== undefined && verdict !== 'approve' && verdict !== 'comment' && verdict !== 'request_changes') {
    throw new Error('Model response verdict must be approve, comment, or request_changes when provided.')
  }

  return {
    summary,
    verdict: verdict as ModelReviewResult['verdict'],
    findings
  }
}

export function safeParseModelResponse(raw: string): ModelReviewResult {
  try {
    return parseModelResponse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parser error.'
    return {
      summary: buildFallbackSummary(raw, message),
      verdict: 'comment',
      findings: [],
      parserWarnings: [message]
    }
  }
}

function buildFallbackSummary(raw: string, warning: string): string {
  const compact = raw.replace(/\s+/g, ' ').trim().slice(0, 500)
  return [
    'The reviewer model returned a response that could not be converted into structured inline findings.',
    `Parser warning: ${warning}`,
    compact ? `Raw response excerpt: ${compact}` : undefined
  ].filter(Boolean).join('\n')
}

function getString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Model response field ${field} must be a non-empty string.`)
  }
  return value
}

function getNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Model response field ${field} must be a positive integer.`)
  }
  return value
}

function getOfficialDocsUrl(value: unknown, field: string): string {
  const url = getString(value, field)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Model response field ${field} must be a valid URL.`)
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error(`Model response field ${field} must use http or https.`)
  }

  return url
}
