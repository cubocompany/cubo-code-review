import { ExecutionTarget, ReviewCommand, SupportedBackend } from './types.js'

const PAIR_REGEX = /([a-zA-Z][a-zA-Z0-9_-]*)=([^\s]+)/g
const SUPPORTED_BACKENDS: SupportedBackend[] = ['openrouter', 'opencode']
const DEFAULT_REVIEW_COMMAND = '/cubo-review'

export function isCuboReviewCommand(body: string, reviewCommand = DEFAULT_REVIEW_COMMAND): boolean {
  const firstLine = getFirstLine(body)
  return buildCommandRegex(reviewCommand).test(firstLine)
}

export function parseReviewCommand(body: string, reviewCommand = DEFAULT_REVIEW_COMMAND): ReviewCommand {
  const firstLine = getFirstLine(body)
  if (!buildCommandRegex(reviewCommand).test(firstLine)) {
    throw new Error(`Comment does not contain a valid ${reviewCommand} command on the first line.`)
  }

  const pairs = [...firstLine.matchAll(PAIR_REGEX)]
  const parsed: ReviewCommand = { raw: firstLine }

  for (const match of pairs) {
    const [, key, value] = match
    switch (key) {
      case 'target':
        parsed.target = parseExecutionTarget(value)
        break
      case 'skill':
        parsed.skill = value
        break
      case 'focus':
        parsed.focus = value
        break
      default:
        break
    }
  }

  return parsed
}

function buildCommandRegex(reviewCommand: string): RegExp {
  const escapedCommand = reviewCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escapedCommand}(?:\\s+.+)?$`)
}

export function parseExecutionTarget(input: string): ExecutionTarget {
  const parts = input.split('/')
  if (parts.length < 3) {
    throw new Error(`Invalid target "${input}". Expected format backend/provider/model.`)
  }

  const [backendRaw, provider, ...modelParts] = parts
  if (!SUPPORTED_BACKENDS.includes(backendRaw as SupportedBackend)) {
    throw new Error(`Unsupported backend "${backendRaw}". Supported backends are: ${SUPPORTED_BACKENDS.join(', ')}.`)
  }
  if (!provider) {
    throw new Error(`Invalid target "${input}". Provider segment is required.`)
  }

  const model = modelParts.join('/')
  if (!model) {
    throw new Error(`Invalid target "${input}". Model segment is required.`)
  }

  return {
    backend: backendRaw as SupportedBackend,
    provider,
    model
  }
}

function getFirstLine(input: string): string {
  return input.split(/\r?\n/, 1)[0].trim()
}
