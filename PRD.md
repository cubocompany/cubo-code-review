# PRD.md

## Product name

cubo-code-review

## Purpose

Provide a reusable GitHub Action that behaves like a human reviewer on pull requests. The action is triggered by a deliberate slash command, reads internal and repository review guidance, sends the PR context to an LLM backend, and submits a grouped formal GitHub review with inline comments.

## Goals

1. Enable review by PR comment using a unique slash command.
2. Support multiple execution backends through a single `target=backend/provider/model` contract.
3. Produce formal GitHub PR reviews with grouped inline comments.
4. Support review language configuration independent of action logs.
5. Allow repository-specific and action-internal skill documents.
6. Return readable configuration and runtime errors in en-US.
7. Be reusable via `owner/repo@tag` across repositories.

## Non-goals

1. Auto-fixing files in the pull request branch.
2. Full AST-level static analysis.
3. Secret scanning or compliance scanning replacement.
4. Automatic merge blocking beyond GitHub's native review semantics.

## Primary users

- Engineering teams that want AI-assisted pull request review.
- Repository maintainers who want review standards encoded in Markdown.
- Teams that need multi-model flexibility without changing the UX.

## User stories

- As a developer, I comment `/cubo-review` on a PR and receive a formal review.
- As a maintainer, I set a default target via action input and override it per PR when needed.
- As a team, I keep general review principles in the action's internal skill and repository specifics in repo Markdown.
- As an organization, I reuse the same action from `owner/repo@tag` across multiple repositories.
- As a reviewer, I want comments categorized as `ISSUE`, `QUESTION`, `NITPICK`, `REFACTOR`, or `SUGGESTION`.

## Functional requirements

1. Trigger only when the first line matches `/cubo-review`.
2. Parse only `key=value` pairs after the command.
3. Support keys `target`, `skill`, and `focus`.
4. Resolve the effective target with precedence: command target, action default target.
5. Resolve the effective user skill with precedence: command skill, action default skill, repository fallbacks.
6. Always prepend the action-internal `SKILL.md` to the model context.
7. Collect PR metadata, changed files, file patches, and diff.
8. Build a structured prompt that requires machine-readable output.
9. Support at least two executors: `openrouter` and `opencode`.
10. Submit a single grouped GitHub review with inline comments.
11. Submit `REQUEST_CHANGES` when any finding category is `issue`.
12. Submit `COMMENT` when no `issue` findings exist.
13. Fall back to file-level comments when line anchoring is not trustworthy.
14. Return clear en-US errors for missing required tokens or malformed inputs.
15. Keep action status logs and exceptions in en-US.
16. Allow the review content language to be configured through `review-language`.

## Success metrics

- Slash command false positive rate approaches zero.
- At least one repository can adopt the action without code changes.
- The action can submit a valid grouped review on a representative test PR.
- Missing configuration errors are understandable without reading source code.

## Risks

- Diff line anchoring can be wrong if the model invents line numbers.
- OpenCode integration details may vary by deployment style.
- Large PRs can exceed prompt budgets.

## Mitigations

- Validate or gracefully degrade to file-level comments.
- Keep executor abstraction narrow.
- Cap diff size and expose truncation in logs.
