import * as core from '@actions/core'
import { context as githubContext } from '@actions/github'
import { parseReviewCommand } from './command/parse-command.js'
import { ExecutionTarget } from './command/types.js'
import { OpenCodeExecutor } from './executors/opencode-executor.js'
import { OpenRouterExecutor } from './executors/openrouter-executor.js'
import { ReviewExecutor } from './executors/review-executor.js'
import { getPullRequestContext } from './github/get-pr-context.js'
import { submitPullRequestReview } from './github/post-pr-review.js'
import { resolveSkillDocuments } from './review/resolve-skill-docs.js'
import { ReviewContext } from './review/types.js'

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github-token', { required: true })
    const defaultTargetRaw = core.getInput('default-target')
    const defaultSkill = core.getInput('default-skill')
    const reviewLanguage = core.getInput('review-language') || 'en-US'
    const commentBody = process.env.COMMENT_BODY ?? githubContext.payload.comment?.body ?? ''

    const command = parseReviewCommand(commentBody)
    const target = command.target ?? (defaultTargetRaw ? parseReviewCommand(`/cubo-review target=${defaultTargetRaw}`).target : undefined)
    if (!target) {
      throw new Error('No target was provided. Set target=... in the command or configure the default-target input.')
    }

    const pr = await getPullRequestContext(githubToken)
    const repositoryRoot = process.cwd()
    const skillDocuments = resolveSkillDocuments({
      repositoryRoot,
      changedFiles: pr.files,
      explicitSkillPath: command.skill,
      defaultSkillPath: defaultSkill
    })

    const reviewContext: ReviewContext = {
      owner: pr.owner,
      repo: pr.repo,
      pullNumber: pr.pullNumber,
      title: pr.title,
      body: pr.body,
      headSha: pr.headSha,
      baseSha: pr.baseSha,
      diff: pr.diff,
      files: pr.files,
      skillDocuments,
      reviewLanguage,
      focus: command.focus,
      target
    }

    const executor = createExecutor(target)
    const result = await executor.run(reviewContext)

    await submitPullRequestReview(githubToken, {
      owner: pr.owner,
      repo: pr.repo,
      pullNumber: pr.pullNumber,
      headSha: pr.headSha,
      files: pr.files,
      result
    })

    core.info(`Submitted review for PR #${pr.pullNumber} using target ${target.backend}/${target.provider}/${target.model}.`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown action failure.'
    core.setFailed(message)
  }
}

function createExecutor(target: ExecutionTarget): ReviewExecutor {
  switch (target.backend) {
    case 'openrouter': {
      const apiKey = core.getInput('openrouter-api-key') || process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OpenRouter backend requires openrouter-api-key input or OPENROUTER_API_KEY environment variable.')
      }
      return new OpenRouterExecutor(apiKey)
    }
    case 'opencode': {
      const apiKey = core.getInput('opencode-api-key') || process.env.OPENCODE_API_KEY
      if (!apiKey) {
        throw new Error('OpenCode backend requires opencode-api-key input or OPENCODE_API_KEY environment variable.')
      }
      return new OpenCodeExecutor(apiKey)
    }
    default:
      throw new Error(`Unsupported backend: ${(target as { backend: string }).backend}`)
  }
}

void run()
