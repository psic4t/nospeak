
# Agent Guidelines

## Commands
- **Build**: `npm run build`
- **Lint/Type Check**: `npm run check` (runs svelte-check against tsconfig)
- **Test**: `npx vitest` (runs all tests; use `--run` for single pass)
- **Single Test**: `npx vitest src/path/to/test.ts` or `npx vitest -t "pattern"`

## Code Style & Conventions
- **Indentation**: Use 4 spaces for indentation.
- **TypeScript**: Strict mode enabled. Define explicit interfaces/types for all data structures.
- **Naming**: PascalCase for Classes/Components/Interfaces. camelCase for functions/vars.
- **Imports**: Group external libraries first, then internal modules.
- **Error Handling**: Use `try/catch` for async operations.
- **Testing**: Write unit tests for logic in `src/lib/core`. Use `vi.mock` for dependencies.
- **Components**: Follow Svelte 5 syntax. Place components in `src/lib/components`.
- **State**: Use Svelte 5 runes or stores in `src/lib/stores`.
- **Validation**: ALWAYS run `npm run check` and `npx vitest run` before finishing a task.
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) with scope, e.g. `fix(android): description`.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
