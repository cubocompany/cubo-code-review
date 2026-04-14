# cubo-code-review

`cubo-code-review` is a reusable GitHub Action that turns a PR comment into a formal GitHub review with grouped inline comments.

## Command

Only the first line is parsed, and only this command triggers the action:

```text
/cubo-review target=openrouter/anthropic/claude-sonnet-4.6 skill=.github/review/SKILL.md
```

Supported keys:

- `target=backend/provider/model`
- `skill=path/to/SKILL.md`
- `focus=security`

## Reusable workflow usage

```yaml
name: Cubo review

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
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: your-org/cubo-code-review@v0.4.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          default-target: openrouter/anthropic/claude-sonnet-4.6
          review-language: pt-BR
          openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
```

## Internal review skill

The action always loads its own internal `SKILL.md` before any user-supplied repository skill files.

## Review outcome

- `REQUEST_CHANGES` when at least one finding is labeled `issue`
- `COMMENT` otherwise


## v4 robustness upgrades

- Safer diff anchoring with file-level fallback when a line cannot be mapped to the patch.
- Prompt truncation and omission for large PRs.
- Safer model-response parsing with automatic fallback summary when the model returns invalid JSON.
- Additional integration tests for line anchoring, prompt truncation, and parser fallback.
