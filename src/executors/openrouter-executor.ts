import { buildReviewPrompt } from '../review/build-review-prompt.js'
import { safeParseModelResponse } from '../review/parse-model-response.js'
import { ReviewContext, ModelReviewResult } from '../review/types.js'
import { ReviewExecutor } from './review-executor.js'

export class OpenRouterExecutor implements ReviewExecutor {
  constructor(private readonly apiKey: string) {}

  async run(context: ReviewContext): Promise<ModelReviewResult> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: `${context.target.provider}/${context.target.model}`,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: buildReviewPrompt(context)
          }
        ]
      })
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`OpenRouter request failed with status ${response.status}: ${text}`)
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('OpenRouter returned an empty response.')
    }

    return safeParseModelResponse(content)
  }
}
