# SPEC.md

## Development approach

This project follows spec-driven development. The implementation must satisfy the contracts below before additional product expansion.

## Command parsing spec

- Input source: first line of `github.event.comment.body`.
- Regex: `^/cubo-review(?:\s+.+)?$`
- Only whitespace-separated `key=value` pairs are accepted after the command.
- Unknown keys are ignored.
- Invalid `target` values fail fast with a readable en-US error.

## Target contract

The public target contract is:

```text
backend/provider/model
```

Examples:

- `openrouter/anthropic/claude-sonnet-4.6`
- `openrouter/openai/gpt-5.4-mini`
- `opencode/qwen/qwen3.6-plus`

Parsed shape:

```ts
{
  backend: 'openrouter' | 'opencode'
  provider: string
  model: string
}
```

## Skill resolution spec

The action must resolve skill context in this order:

1. Internal action skill at `src/internal/SKILL.md`.
2. Explicit user skill from `skill=...`, if present.
3. Default action skill input, if present.
4. Repository fallback docs discovered by filename proximity.

Fallback filenames:

- `SKILL.md`
- `review.md`
- `AGENTS.md`
- `CLAUDE.md`

Behavior:

- Deduplicate by path.
- Preserve deterministic ordering.
- Ignore missing optional files.
- Throw a readable en-US error when an explicit `skill=` path is missing.

## Prompt spec

The prompt must include:

1. Internal action review rules.
2. User repository skills.
3. Review language.
4. Optional focus.
5. PR metadata.
6. Changed files with patches.
7. Required JSON output schema.

The model must be instructed to return JSON only.

## Model response schema

```json
{
  "summary": "string",
  "verdict": "comment | request_changes",
  "findings": [
    {
      "category": "issue | question | nitpick | refactor | suggestion",
      "path": "src/file.ts",
      "line": 10,
      "body": "comment text",
      "startLine": 8,
      "suggestedCode": "optional replacement code",
      "documentationUrl": "optional official docs URL"
    }
  ]
}
```

## Review submission spec

- The action must create a grouped review on the PR.
- Review event must be:
  - `REQUEST_CHANGES` when at least one finding category is `issue`
  - `COMMENT` otherwise
- Inline comments must be attached using file and line when possible.
- File-level comments must be used when line anchoring is unavailable.
- Comment bodies must use category prefixes, for example `ISSUE:`.
- Suggested code must use GitHub suggestion markdown blocks when attached to a line comment.

## Error handling spec

All action-facing errors must be en-US and human-readable.

Required examples:

- missing GitHub token
- missing backend API key
- malformed target
- missing explicit skill file
- unsupported backend
- empty or invalid model response

## Test spec

Required test groups:

1. Unit tests for command parsing.
2. Unit tests for skill resolution.
3. Integration tests for review payload creation.
4. Integration tests for missing configuration errors.

## Publication spec

The action must be usable as a reusable action via:

```text
owner/repo@tag
```

The repository must include:

- `action.yml`
- compiled `dist/`
- `README.md`
- semantic tag recommendation in docs
