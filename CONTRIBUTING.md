# Contributing

This repository uses Conventional Commits for release automation.

## Commit and PR title format

Use one of these prefixes:

- `feat:` for user-facing features and non-breaking additions
- `fix:` for bug fixes
- `refactor:` for internal refactors
- `perf:` for performance improvements
- `docs:` for documentation changes
- `test:` for test changes
- `build:` for build and packaging changes
- `ci:` for GitHub Actions and pipeline changes
- `chore:` for maintenance that should not appear prominently in release notes

Examples:

- `feat: add sync job headers for audio activity`
- `fix: reject private URL redirects by default`
- `refactor: split input fetcher validation`

## Release model

- Merges to `main` or `master` update the release PR automatically.
- Merging the release PR creates the next version tag and GitHub Release automatically.
- Container images are published from the release workflow with semantic Docker tags such as `1.2.3`, `1.2`, `1`, and `latest`.

## Validation

Before opening a PR, run:

```bash
cd src
npm test
```

```bash
npx @redocly/cli lint docs/openapi.yaml
```

If you are still inside `src/`, run:

```bash
npx @redocly/cli lint ../docs/openapi.yaml
```
