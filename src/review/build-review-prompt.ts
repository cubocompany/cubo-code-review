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
    'Changed files and patches:',
    fileSections.join('\n\n'),
    omittedBlock,
    truncatedBlock,
    '',
    'Return only valid JSON using this schema:',
    '{',
    '  "summary": "string",',
    '  "verdict": "comment | request_changes",',
    '  "findings": [',
    '    {',
    '      "category": "issue | question | nitpick | refactor | suggestion",',
    '      "path": "relative/path.ts",',
    '      "line": 10,',
    '      "startLine": 8,',
    '      "body": "Actionable review comment in the requested review language.",',
    '      "suggestedCode": "optional replacement code",',
    '      "documentationUrl": "optional official documentation URL"',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- ALWAYS include "line" for findings that can be tied to a specific line in the patch. Inline comments are only possible when "line" is provided.',
    '- "line" must be the exact line number from the right side of the diff (the "+" lines). Only use line numbers that appear in the provided patch.',
    '- Use "startLine" together with "line" when the finding spans multiple consecutive added lines.',
    '- Omit "line" and use a file-level finding only when no specific line can be confidently identified in the patch.',
    '- Add documentationUrl only when it points to official docs.',
    '- Keep summary concise.',
    '- Never wrap the JSON in markdown fences.',
    '- Omit optional fields (suggestedCode, documentationUrl, line, startLine) entirely when not applicable. Do not use empty strings or null for optional fields.'
  ].filter(Boolean).join('\n')

  return { prompt, includedFiles, omittedFiles, truncatedFiles }
}

function buildFileSection(file: PullRequestFile): string {
  const patch = truncatePatch(file.patch ?? '[No patch available]')
  return `## File: ${file.path}\nStatus: ${file.status}\nPatch:\n\n${patch}`
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
