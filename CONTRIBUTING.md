# Contributing

## Branch naming
`<type>/<short-description>` where `type` is one of:
- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation only
- `refactor` — code change, no behavior change
- `test` — add/fix tests
- `chore` — build/tooling/CI

Example: `fix/ota-version-compare`, `feat/firmware-latest-endpoint`

## Commit messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
<type>: <subject>
```
- `type` matches branch type (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`)
- subject ≤ 72 chars, lowercase, no trailing period
- body optional, explain *why*

Examples:
- `fix: compare OTA against stored current_version`
- `feat: add JWT auth to device management routes`

## Pull requests
- Use the PR template (Summary / Changes / Test plan)
- Reference related issues with `Closes #N`
- CI (`build-and-test`) must pass before merge
- Squash-merge to `main`

## Issues
Use the issue templates (`bug.md`, `task.md`). Label appropriately.

## Coding standards
See `AGENT.md` — Pure SQL (parameterized `?`), Express `Router()`, ESM `.js` imports, manual UUID, soft deletes, dual-path storage.
