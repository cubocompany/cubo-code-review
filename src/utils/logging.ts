import * as core from '@actions/core'

export function info(message: string): void {
  core.info(message)
}

export function failAndThrow(message: string): never {
  core.setFailed(message)
  throw new Error(message)
}
