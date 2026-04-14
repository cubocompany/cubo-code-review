export type SupportedBackend = 'openrouter' | 'opencode'

export type ExecutionTarget = {
  backend: SupportedBackend
  provider: string
  model: string
}

export type ReviewCommand = {
  raw: string
  target?: ExecutionTarget
  skill?: string
  focus?: string
}
