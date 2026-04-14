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
  const allComments = buildInlineReviewComments(payload.files, payload.result.findings)
  const event = determineReviewEvent(payload.result)

  const inlineComments = allComments.filter((c) => c.subject_type !== 'file')
  const fileComments = allComments.filter((c) => c.subject_type === 'file')

  const fileCommentsText = fileComments.length > 0
    ? '\n\n---\n**File-level findings:**\n' + fileComments.map((c) => `- \`${c.path}\`: ${c.body}`).join('\n')
    : ''

  await octokit.rest.pulls.createReview({
    owner: payload.owner,
    repo: payload.repo,
    pull_number: payload.pullNumber,
    commit_id: payload.headSha,
    body: payload.result.summary + fileCommentsText,
    event,
    comments: inlineComments.map(({ subject_type: _, ...rest }) => rest)
  })
}
