# cubo-code-review

A reusable GitHub Action that turns a PR comment into a formal GitHub review with grouped inline comments, powered by AI models via OpenRouter or OpenCode.

## How it works

A maintainer or contributor posts a review command comment on any pull request. By default the command is `/cubo-review`, but it can be customized (for example `/uqbar-review`). The action reads the diff, loads skill documents, calls the configured AI model, and submits a structured GitHub review with inline comments.

## Quick start

Create `.github/workflows/review.yml` in any repository:

```yaml
name: Cubo Review

on:
  issue_comment:
    types: [created]

jobs:
  review:
    if: ${{ github.event.issue.pull_request && startsWith(github.event.comment.body, '/cubo-review') }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: cubocompany/cubo-code-review@v1.0.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          review-command: /cubo-review
          default-target: openrouter/anthropic/claude-sonnet-4-5
          review-language: pt-BR
          openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
        env:
          COMMENT_BODY: ${{ github.event.comment.body }}
```

Then add the required secret in **Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |

Trigger the review by commenting on any PR:

```
/cubo-review
```

---

## Action inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `github-token` | Yes | — | GitHub token with `pull-requests: write` permission. Use `${{ secrets.GITHUB_TOKEN }}`. |
| `default-target` | No | — | Fallback AI target used when the comment does not specify `target=`. Format: `backend/provider/model`. |
| `default-skill` | No | — | Path to a skill file inside the repository, loaded as the default review guide. Silently ignored if the file does not exist. |
| `review-command` | No | `/cubo-review` | Command that triggers the action from a PR comment. Example: `/cubo-review`, `/uqbar-review`. |
| `review-language` | No | `en-US` | Language for the review output. Examples: `en-US`, `pt-BR`, `es-ES`. |
| `openrouter-api-key` | No | — | Required when the target backend is `openrouter`. |
| `opencode-api-key` | No | — | Required when the target backend is `opencode`. |

> The `COMMENT_BODY` environment variable must be set to `${{ github.event.comment.body }}` so the action can read the PR comment that triggered it.

---

## Command syntax

Only the **first line** of the comment is parsed. All keys are optional.

```
<review-command> [target=backend/provider/model] [skill=path/to/SKILL.md] [focus=topic]
```

By default, `<review-command>` is `/cubo-review`. If you configure `review-command: /uqbar-review`, then the first line must start with `/uqbar-review` instead.

| Key | Description |
|---|---|
| `target` | Overrides `default-target` for this review. Format: `backend/provider/model`. |
| `skill` | Overrides `default-skill` for this review. Path relative to the repository root. File must exist or the action fails. |
| `focus` | Narrows the review to a specific concern (e.g. `security`, `performance`, `naming`). |

### Examples

```
/cubo-review
```
```
/cubo-review target=openrouter/anthropic/claude-sonnet-4-5
```
```
/cubo-review skill=.github/review/SKILL.md focus=security
```
```
/cubo-review target=opencode/openai/gpt-4o skill=.github/review/SKILL.md focus=performance
```

Custom command example:

```yaml
jobs:
  review:
    if: ${{ github.event.issue.pull_request && startsWith(github.event.comment.body, '/uqbar-review') }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: cubocompany/cubo-code-review@v1.0.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          review-command: /uqbar-review
          default-target: openrouter/anthropic/claude-sonnet-4-5
          openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
        env:
          COMMENT_BODY: ${{ github.event.comment.body }}
```

Trigger it with:

```
/uqbar-review
```

---

## Supported backends

| Backend | Input key | Environment variable |
|---|---|---|
| `openrouter` | `openrouter-api-key` | `OPENROUTER_API_KEY` |
| `opencode` | `opencode-api-key` | `OPENCODE_API_KEY` |

---

## Skill documents

Skill documents are Markdown files that guide the AI during the review. The action loads them in the following order:

1. **Internal skill** — built into the action, always loaded.
2. **Explicit skill** (`skill=` in command) — must exist, throws if missing.
3. **Default skill** (`default-skill` input) — silently skipped if missing.
4. **Fallback discovery** — the action automatically searches for any of these filenames in the repository root, `.github/review/`, and in every directory of the changed files (walking up to the root):
   - `SKILL.md`
   - `review.md`
   - `AGENTS.md`
   - `CLAUDE.md`

### Example skill file

```markdown
# Review guidelines

- In React files, prefer explicit prop typing.
- In API handlers, flag missing input validation.
- Prefer early returns over deeply nested conditionals.
```

Place it at `.github/review/SKILL.md` and reference it via `default-skill`:

```yaml
- uses: cubocompany/cubo-code-review@v1.0.0
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    review-command: /cubo-review
    default-target: openrouter/anthropic/claude-sonnet-4-5
    default-skill: .github/review/SKILL.md
    openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
  env:
    COMMENT_BODY: ${{ github.event.comment.body }}
```

---

## Review outcome

| Result | Condition |
|---|---|
| `REQUEST_CHANGES` | At least one finding is categorized as `issue` |
| `COMMENT` | All findings are suggestions, nitpicks, or praise |

---

## Complete workflow example

```yaml
name: Cubo Review

on:
  issue_comment:
    types: [created]

jobs:
  review:
    if: ${{ github.event.issue.pull_request && startsWith(github.event.comment.body, '/cubo-review') }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: cubocompany/cubo-code-review@v1.0.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          review-command: /cubo-review
          default-target: openrouter/anthropic/claude-sonnet-4-5
          default-skill: .github/review/SKILL.md
          review-language: pt-BR
          openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
        env:
          COMMENT_BODY: ${{ github.event.comment.body }}
```
