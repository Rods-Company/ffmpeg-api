## Summary

- explain what changed
- mention behavior impact
- mention any env or release impact

## Validation

- [ ] `npm test`
- [ ] `npx @redocly/cli lint docs/openapi.yaml`

## Conventional title

Use a Conventional Commit style title because the release pipeline generates version bumps and release notes from this format.

Examples:

- `feat: add webhook delivery retries`
- `fix: handle empty ogg uploads`
- `refactor: split media processor filters`
