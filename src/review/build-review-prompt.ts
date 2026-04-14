import { PromptBuildResult, PullRequestFile, ReviewContext } from './types.js'

const MAX_PROMPT_CHARS = 45000
const MAX_PATCH_CHARS_PER_FILE = 5000

export function buildReviewPrompt(context: ReviewContext): string {
  return buildReviewPromptWithMetadata(context).prompt
}

export function buildReviewPromptWithMetadata(context: ReviewContext): PromptBuildResult {
  const skills = context.skillDocuments
    .map((doc) => `### ${doc.source.toUpperCase()} :: ${doc.path}\n${doc.content}`)
    .join('\n\n')

  const sortedFiles = [...context.files]
    .sort((a, b) => scoreFileForPrompt(b) - scoreFileForPrompt(a))

  let budget = MAX_PROMPT_CHARS
  const includedFiles: string[] = []
  const omittedFiles: string[] = []
  const truncatedFiles: string[] = []
  const fileSections: string[] = []

  for (const file of sortedFiles) {
    const section = buildFileSection(file)
    const cost = section.length + 2
    if (cost <= budget) {
      fileSections.push(section)
      includedFiles.push(file.path)
      if ((file.patch ?? '').length > MAX_PATCH_CHARS_PER_FILE) {
        truncatedFiles.push(file.path)
      }
      budget -= cost
    } else {
      omittedFiles.push(file.path)
    }
  }

  const omittedBlock = omittedFiles.length
    ? `\n\nFiles omitted due to size budget: ${omittedFiles.join(', ')}`
    : ''
  const truncatedBlock = truncatedFiles.length
    ? `\n\nFiles with truncated patches: ${truncatedFiles.join(', ')}`
    : ''

  const prompt = [
    'You are reviewing a GitHub pull request. Return JSON only.',
    `Review language: ${context.reviewLanguage}`,
    `Target backend/provider/model: ${context.target.backend}/${context.target.provider}/${context.target.model}`,
    context.focus ? `Review focus: ${context.focus}` : undefined,
    '',
    'Apply the following skill documents in order:',
    skills,
    '',
    `Pull request #${context.pullNumber}: ${context.title}`,
    `PR description:\n${context.body || '[No description provided]'}`,
    '',
    'Changed files and patches (each line is prefixed with its right-side line number):',
    fileSections.join('\n\n'),
    omittedBlock,
    truncatedBlock,
    '',
    'Return only valid JSON using this schema:',
    '{',
    '  "summary": "string (short review outcome only; do not restate the implementation)",',
    '  "verdict": "approve | comment | request_changes",',
    '  "findings": [',
    '    {',
    '      "category": "issue | question | nitpick | refactor | suggestion",',
    '      "path": "relative/path.ts",',
    '      "line": 10,',
    '      "startLine": 8,',
    '      "body": "Actionable review comment text only, without any label prefix.",',
    '      "suggestedCode": "optional replacement code for the exact added line indicated",',
    '      "documentationUrl": "optional official documentation URL"',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- ALWAYS include "line" for every finding. Read the number prefix at the start of each patch line — that IS the right-side line number to use. Do not calculate or guess.',
    '- CRITICAL: Only provide "suggestedCode" for added lines marked with a + prefix in the patch. Never provide "suggestedCode" for context lines. Verify that "line" points to the EXACT added line whose content you want to replace. If unsure, omit suggestedCode.',
    '- Use "startLine" together with "line" when the finding spans multiple consecutive lines.',
    '- You can comment on any visible right-side line in the patch (context or added lines). Never target deleted lines.',
    '- Do NOT include Conventional Comments labels in `body`. Return plain comment text only. The formatter will add labels such as `**suggestion:**` or `**issue (blocking):**`.',
    '- Use verdict "approve" when there are no issues or only minor nitpicks. Use "request_changes" only for correctness, safety, or critical problems. Use "comment" otherwise.',
    '- Summary must be at most 2 short sentences and must describe only the review outcome. Do not restate what the PR implemented. If the PR is clean, use exactly: "Pull Request aprovado sem mudanças necessárias."',
    '- Never wrap the JSON in markdown fences.',
    '- Omit optional fields (suggestedCode, documentationUrl, line, startLine) entirely when not applicable. Do not use empty strings or null.'
  ].filter(Boolean).join('\n')

  return { prompt, includedFiles, omittedFiles, truncatedFiles }
}

function buildFileSection(file: PullRequestFile): string {
  const patch = truncatePatch(file.patch ?? '[No patch available]')
  const annotated = annotatePatchWithLineNumbers(patch)
  return `## File: ${file.path}\nStatus: ${file.status}\nPatch:\n\n${annotated}`
}

function annotatePatchWithLineNumbers(patch: string): string {
  const lines = patch.split('\n')
  const annotated: string[] = []
  let rightLine = 0

  for (const line of lines) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (header) {
      rightLine = Number(header[1])
      annotated.push(line)
      continue
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      annotated.push(`    :${line}`)
      continue
    }

    if (line.startsWith('\\')) {
      annotated.push(line)
      continue
    }

    annotated.push(`${String(rightLine).padStart(4)}:${line}`)
    rightLine += 1
  }

  return annotated.join('\n')
}

function truncatePatch(patch: string): string {
  if (patch.length <= MAX_PATCH_CHARS_PER_FILE) {
    return patch
  }
  return `${patch.slice(0, MAX_PATCH_CHARS_PER_FILE)}\n\n[Patch truncated to keep the prompt within budget.]`
}

function scoreFileForPrompt(file: PullRequestFile): number {
  const patchLength = (file.patch ?? '').length
  const extension = file.path.split('.').pop() ?? ''
  const sourceBonus = ['ts', 'tsx', 'js', 'jsx', 'go', 'rb', 'py', 'java', 'kt', 'rs'].includes(extension) ? 5000 : 0
  const docsPenalty = ['md', 'txt'].includes(extension) ? -500 : 0
  return Math.min(patchLength, 10000) + sourceBonus + docsPenalty
}
