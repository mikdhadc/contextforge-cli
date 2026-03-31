# Contributing to ContextForge

Thank you for taking the time to contribute! This document walks you through the full process from forking to a merged pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Before You Start](#before-you-start)
- [Development Setup](#development-setup)
- [Contribution Workflow](#contribution-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Testing](#testing)
- [Project Structure](#project-structure)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

---

## Before You Start

- **Check existing issues** — search [open issues](../../issues) before creating a new one to avoid duplicates.
- **For large changes**, open an issue first to discuss the approach before writing code. This saves everyone time.
- **For small changes** (typos, minor bug fixes), you can go straight to a pull request.

---

## Development Setup

### Requirements

- Node.js >= 20
- pnpm >= 9

### Steps

**1. Fork the repository**

Click the **Fork** button on the top right of the GitHub repository page.

**2. Clone your fork**

```bash
git clone https://github.com/<your-username>/context-forge-npm.git
cd context-forge-npm
```

**3. Add the upstream remote**

```bash
git remote add upstream https://github.com/originalowner/context-forge-npm.git
```

Verify:
```bash
git remote -v
# origin    https://github.com/<your-username>/context-forge-npm.git (fetch)
# upstream  https://github.com/originalowner/context-forge-npm.git (fetch)
```

**4. Install dependencies**

```bash
pnpm install
```

**5. Build all packages**

```bash
pnpm build
```

**6. Run the test suite to confirm your setup is working**

```bash
pnpm test
```

All tests should pass before you make any changes.

---

## Contribution Workflow

### 1. Create or find an issue

Every contribution should be tied to an issue. If one doesn't exist yet:
- Go to [Issues](../../issues) → **New Issue**
- Choose the appropriate template (Bug Report, Feature Request, or Documentation)
- Fill in all required fields and submit

Note the issue number — you will reference it in your branch name and commit messages.

### 2. Sync your fork with upstream

Before starting work, make sure your `main` branch is up to date:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

### 3. Create a feature branch

Branch off `main` using a descriptive name:

```bash
# For features
git checkout -b feat/issue-42-ide-selector

# For bug fixes
git checkout -b fix/issue-38-gitignore-mcp-json

# For documentation
git checkout -b docs/issue-55-contributing-guide
```

**Branch naming convention:** `<type>/issue-<number>-<short-description>`
Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

### 4. Implement your changes

Make your changes in the relevant package(s) under `packages/`. Follow the existing code style — TypeScript strict mode, ESM imports, named exports.

### 5. Write tests

Every code change must include tests. ContextForge uses **Vitest** across all packages.

- Unit tests live in `packages/<name>/src/__tests__/`
- Test file naming: `<module>.test.ts`
- Write tests for both the happy path and edge cases

```bash
# Run tests for a specific package during development
cd packages/cli && pnpm exec vitest run

# Run all tests
pnpm test
```

### 6. Ensure all tests pass

```bash
pnpm test
```

Do not submit a PR with failing tests.

### 7. Lint and build

```bash
pnpm build
```

Fix any TypeScript errors before opening a PR.

### 8. Rebase on upstream main (before opening PR)

```bash
git fetch upstream
git rebase upstream/main
```

Resolve any conflicts, then:

```bash
git push origin <your-branch> --force-with-lease
```

### 9. Open a Pull Request

- Go to your fork on GitHub and click **Compare & pull request**
- Fill in the pull request template completely
- Link the issue: `Closes #42`
- Request a review if you know who to tag

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer: Closes #issue]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

**Scope:** the package name or area — `cli`, `scanner`, `generator`, `mcp`, `bootstrapper`, `watcher`

**Examples:**

```
feat(cli): prompt for IDE selection when --ide is not provided
fix(cli): include .mcp.json in gitignore tracking
docs(contributing): add upstream sync step
test(generator): add hash sensitivity tests
```

Keep the subject line under 72 characters. Use the body for context on *why*, not *what*.

---

## Pull Request Guidelines

- **One PR per issue** — keep changes focused
- **Small PRs merge faster** — split unrelated changes into separate PRs
- **Update tests** — new behaviour must have tests; bug fixes must have a regression test
- **Update documentation** — update `README.md` if the CLI interface or behaviour changes
- **No breaking changes without discussion** — open an issue first if your change affects the public API or generated output format
- **CI must pass** — the PR checks (build, test on Node 20 + 22) must be green

---

## Testing

| Command | Description |
|---|---|
| `pnpm test` | Run all tests across all packages |
| `cd packages/<name> && pnpm exec vitest run` | Run tests for a single package |
| `cd packages/<name> && pnpm exec vitest` | Watch mode for a single package |

Tests use `tmp` directories for filesystem assertions — they clean up after themselves. Do not write tests that depend on the state of the actual repository.

---

## Project Structure

```
packages/
  scanner/       — project detection + AST-based convention analysis (web-tree-sitter WASM)
  watcher/       — chokidar-based FS watcher, classifies meaningful changes
  generator/     — .context.md renderer + patcher + IDE file writer
  bootstrapper/  — one-time setup (.contextforge/, MCP config)
  mcp/           — MCP server + full/incremental pipeline
  cli/           — contextforge binary (init, serve, status, switch, audit, templates)
```

Package dependency order: `scanner` ← `generator` ← `bootstrapper`, `mcp` ← `cli`

When adding a new feature, identify which package owns it. Cross-package changes should be made in dependency order and tested at each layer.

---

## Adding Your Name to the Contributors List

Once your PR is merged, add yourself to the [Contributors](README.md#contributors) section in `README.md`:

```markdown
| [Your Name](https://github.com/your-username) | Brief description of your contribution |
```

You can include this as part of the PR that contains your contribution.
