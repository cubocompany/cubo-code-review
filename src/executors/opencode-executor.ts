import { buildReviewPrompt } from '../review/build-review-prompt.js'
import { safeParseModelResponse } from '../review/parse-model-response.js'
import { ReviewContext, ModelReviewResult } from '../review/types.js'
import { ReviewExecutor } from './review-executor.js'

export class OpenCodeExecutor implements ReviewExecutor {
  constructor(private readonly apiKey: string) {}

  async run(context: ReviewContext): Promise<ModelReviewResult> {
    const endpoint = process.env.OPENCODE_API_URL
    if (!endpoint) {
      throw new Error('OpenCode backend requires OPENCODE_API_URL to be set.')
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        provider: context.target.provider,
        model: context.target.model,
        prompt: buildReviewPrompt(context)
      })
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`OpenCode request failed with status ${response.status}: ${text}`)
    }

    const data = await response.json() as { output?: string, content?: string }
    const content = data.output ?? data.content
    if (!content) {
      throw new Error('OpenCode returned an empty response.')
    }

    return safeParseModelResponse(content)
  }
}
