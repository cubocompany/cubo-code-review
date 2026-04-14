import { ReviewContext, ModelReviewResult } from '../review/types.js'

export interface ReviewExecutor {
  run(context: ReviewContext): Promise<ModelReviewResult>
}
