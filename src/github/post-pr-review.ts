import { getOctokit } from '@actions/github'
import { ModelReviewResult, PullRequestFile } from '../review/types.js'
import { buildInlineReviewComments, determineReviewEvent } from './review-payload.js'

export type CreateReviewPayload = {
  owner: string
  repo: string
  pullNumber: number
  headSha: string
  files: PullRequestFile[]
  result: ModelReviewResult
}

export async function submitPullRequestReview(token: string, payload: CreateReviewPayload): Promise<void> {
  const octokit = getOctokit(token)
  const comments = buildInlineReviewComments(payload.files, payload.result.findings)
  const event = determineReviewEvent(payload.result)
  await octokit.rest.pulls.createReview({
    owner: payload.owner,
    repo: payload.repo,
    pull_number: payload.pullNumber,
    commit_id: payload.headSha,
    body: payload.result.summary,
    event,
    comments
  })
}
