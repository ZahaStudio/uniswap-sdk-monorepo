- DO NOT worry about tests, never create tests.
- DO NOT worry about backwards compatibility, and never write defensive or backwards compatible code.
- DO NOT run dev servers, assume they are already running. If not, ask the user.
- Prefer fact checking yourself with web search.

# TypeScript & Package

- Do not add new packages to catalog unless explicitly asked.
- Do not run build again and again for verification/validation, typecheck is enough.

<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->
