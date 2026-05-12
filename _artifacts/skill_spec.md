# Community Uniswap SDK Intent Skill Spec

This Intent migration covers the stable Uniswap v4 SDK packages only. The skills are written for coding agents that need to generate correct application code against the current public APIs.

## Skill Set

- `uniswap-sdk-core` lives in `packages/uniswap-sdk/skills/uniswap-sdk-core/SKILL.md`.
- `react-uniswap-sdk` lives in `packages/uniswap-sdk-react/skills/react-uniswap-sdk/SKILL.md` and requires `uniswap-sdk-core`.

## Authoring Rules

- Keep skills package-local so they ship with the npm packages that expose the APIs.
- Keep root `_artifacts` as the monorepo-wide domain map and skill tree source of truth.
- Keep examples minimal, complete, and grounded in real package imports.
- Focus on Uniswap v4-specific failure modes that agents are likely to generate incorrectly.

## Maintenance

- Update skills when `docs/`, `packages/uniswap-sdk/src/`, or `packages/uniswap-sdk-react/src/` change in ways that affect public usage.
- Run `npx @tanstack/intent@latest validate` from each Uniswap v4 package directory before publishing.
- Run `npx @tanstack/intent@latest stale` from the repository root to catch package coverage and source drift signals.
