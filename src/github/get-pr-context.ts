import { context as githubContext, getOctokit } from '@actions/github'
import { PullRequestFile } from '../review/types.js'

export type PullRequestContext = {
  owner: string
  repo: string
  pullNumber: number
  title: string
  body: string
  headSha: string
  baseSha: string
  files: PullRequestFile[]
  diff: string
}

export async function getPullRequestContext(token: string): Promise<PullRequestContext> {
  const octokit = getOctokit(token)
  const owner = githubContext.repo.owner
  const repo = githubContext.repo.repo
  const pullNumber = githubContext.payload.issue?.number

  if (!pullNumber || !githubContext.payload.issue?.pull_request) {
    throw new Error('This action can only run from a pull request issue_comment event.')
  }

  const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber })
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  })

  const diffResponse = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
    headers: {
      accept: 'application/vnd.github.v3.diff'
    }
  })

  return {
    owner,
    repo,
    pullNumber,
    title: pr.data.title,
    body: pr.data.body ?? '',
    headSha: pr.data.head.sha,
    baseSha: pr.data.base.sha,
    diff: typeof diffResponse.data === 'string' ? diffResponse.data : '',
    files: files.map((file) => ({
      path: file.filename,
      status: file.status,
      patch: file.patch
    }))
  }
}
