# ContextForge

ContextForge scans your codebase, detects conventions, and generates a `.context.md` file that AI-powered IDEs (Claude Code, Cursor, Windsurf, VS Code Copilot) read automatically. It also runs as an MCP server, giving those IDEs live access to your project's conventions, prior decisions, and relevant context through four purpose-built tools.

---

## Quick start

```bash
# Install globally
npm install -g contextforge

# In your project root
contextforge init
```

`init` does three things in one shot:

1. **Bootstraps** `.contextforge/` (config, decisions log, MCP server registration)
2. **Scans** your codebase — detects languages, frameworks, naming conventions, import style, test patterns
3. **Generates** `.context.md` + the IDE-specific file for your detected editor

When run interactively, `init` walks you through three prompts:

1. **IDE selection** — choose from the supported list if `--ide` is not passed
2. **Slash command templates** — apply all five templates to your IDE's command directory
3. **`.gitignore`** — add all generated files (`.contextforge/`, `.mcp.json`, IDE files) to `.gitignore`

To skip prompts in CI or scripts, use flags directly:

```bash
contextforge init --ide claude-code --templates --gitignore
```

---

## CLI commands

| Command | Description |
|---|---|
| `contextforge init` | Full bootstrap + scan + generate. Prompts interactively to apply templates and add to `.gitignore`. Flags: `--force` (re-scan even if fresh), `--ide <target>` (override IDE detection), `--templates` (skip prompts, apply templates), `--gitignore` (skip prompts, add to .gitignore). |
| `contextforge serve` | Start the MCP stdio server (used by IDE MCP integrations). |
| `contextforge status` | Show context freshness, last updated, detected IDE, and section list. |
| `contextforge switch <ide>` | Re-write the IDE-specific file from the existing `.context.md` without re-scanning. |
| `contextforge audit` | Health check: context freshness, IDE file, sections, contested conventions, templates. `--json` for CI. `--fix` to auto-resolve. |
| `contextforge templates list` | List the five built-in slash command templates. |
| `contextforge templates apply <name>` | Write a slash command template to the IDE-specific directory. `--all` writes all five. |

### IDE targets

`claude-code` · `cursor` · `windsurf` · `vscode` · `antigravity` · `bob`

---

## MCP server setup

The MCP server exposes four tools that let your AI assistant pull live project context during a conversation.

### Claude Code

`contextforge init` writes `.mcp.json` at your project root automatically. You can also add it manually:

```json
{
  "mcpServers": {
    "contextforge": {
      "command": "npx",
      "args": ["-y", "contextforge-mcp"]
    }
  }
}
```

### Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "contextforge": {
      "command": "npx",
      "args": ["-y", "contextforge-mcp"]
    }
  }
}
```

### Windsurf

```json
// .windsurf/mcp.json
{
  "mcpServers": {
    "contextforge": {
      "command": "npx",
      "args": ["-y", "contextforge-mcp"]
    }
  }
}
```

### VS Code (Copilot)

```json
// .vscode/mcp.json
{
  "servers": {
    "contextforge": {
      "command": "npx",
      "args": ["-y", "contextforge-mcp"]
    }
  }
}
```

### Antigravity

```json
// .antigravity/mcp.json
{
  "mcpServers": {
    "contextforge": {
      "command": "npx",
      "args": ["-y", "contextforge-mcp"]
    }
  }
}
```

### Bob

```json
// .bob/mcp.json
{
  "mcpServers": {
    "contextforge": {
      "command": "npx",
      "args": ["-y", "contextforge-mcp"]
    }
  }
}
```

---

## MCP tools

Once the server is running, your AI assistant can call these tools:

| Tool | Description |
|---|---|
| `get_project_conventions` | Returns all detected conventions with confidence scores. Contested conventions (split codebase) are flagged with ⚠. |
| `get_relevant_context` | Searches `.context.md` sections and the decisions log for a given `feature_area`. |
| `enrich_prompt` | Wraps a raw prompt with stack context, conventions, prior decisions, and known anti-patterns. |
| `log_decision` | Appends an architectural decision to `.contextforge/decisions.jsonl`. |

### Example — enrich a prompt

```
use the enrich_prompt tool with "add user authentication"
```

The assistant receives the raw prompt augmented with your stack, detected conventions (e.g. "camelCase functions, named imports"), prior decisions (e.g. "chose JWT over sessions"), and anti-patterns to avoid.

---

## Slash command templates

ContextForge ships five built-in templates for common AI workflows. Apply them once and they appear as slash commands in your IDE:

| Template | What it does |
|---|---|
| `feature` | Calls `get_relevant_context` + `get_project_conventions` before scaffolding |
| `bugfix` | Root-cause workflow, checks decisions log, requires regression test |
| `refactor` | Maps blast radius, checks contested conventions, logs decision |
| `review` | Convention-aware code review checklist |
| `explain` | Structured deep-dive using live project context |

```bash
contextforge templates apply --all --ide claude-code
# Writes to .claude/commands/*.md
```

---

## How `.context.md` works

ContextForge generates six delimited sections:

```
<!-- contextforge:stack:start hash="a1b2c3d4" -->
## Stack
...
<!-- contextforge:stack:end -->
```

The hash covers the inputs that produced each section. On the next `init`, only sections whose inputs changed are rewritten — manual content you add inside `<!-- contextforge:manual:start/end -->` blocks is **never touched**.

### IDE-specific files

The same content is stripped of delimiters and written to the IDE's native instruction file:

| IDE | File |
|---|---|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |
| VS Code | `.github/copilot-instructions.md` |
| Antigravity | `.antigravity-context.md` |
| Bob | `.bob/context.md` |

---

## What gets detected

**Languages:** TypeScript · JavaScript · Python · Go · Rust · PHP · Ruby

**Frameworks:** React · Next.js · Express · NestJS · Vue · Svelte · FastAPI · Django · Flask · Gin · Echo · Actix · Axum · Laravel · Symfony · Rails · Sinatra

**Conventions (via tree-sitter AST):**
- Function, class, variable, constant naming (camelCase / snake_case / PascalCase / SCREAMING_SNAKE)
- Import style (named / default / namespace)
- Export style
- Test file patterns and framework

Conventions include a **confidence score** (% of files using that pattern) and are flagged as **contested** when the codebase is split (< 60% majority). Contested conventions show the minority locations to help you decide which way to align.

---

## Docker

Run the MCP server in a container, mounting your project at `/project`:

```bash
docker build -t contextforge-mcp .

docker run --rm -i \
  -v /path/to/your/project:/project \
  -e PROJECT_ROOT=/project \
  contextforge-mcp
```

The container communicates over stdio — no port is exposed.

---

## Monorepo structure

```
packages/
  scanner/       — project detection + AST-based convention analysis (tree-sitter)
  watcher/       — chokidar-based FS watcher, classifies meaningful changes
  generator/     — .context.md renderer + patcher + IDE file writer
  bootstrapper/  — one-time setup (.contextforge/, MCP config)
  mcp/           — MCP server + pipeline (full + incremental)
  cli/           — contextforge binary (init, serve, status, switch, audit, templates)
```

Dependency order: `scanner` ← `generator` ← `bootstrapper`, `mcp` ← `cli`

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages (dependency order maintained by pnpm -r)
pnpm build

# Run all tests
pnpm test

# Watch a specific package
cd packages/scanner && pnpm dev
```

### Running tests for a single package

```bash
cd packages/cli && pnpm exec vitest run
```

### CI

GitHub Actions runs on every push to `main` and on all PRs:

- **Test job** — Node 20 + 22 matrix, frozen-lockfile install, build, test
- **Docker job** — builds the image (no push) after tests pass
- **Publish job** — triggers on `v*` tags, publishes all packages to npm

---

## Architecture notes

**Incremental pipeline** — The watcher classifies file changes into four categories (`dependency-manifest`, `config`, `schema`, `new-directory`). On a change, the pipeline re-scans only the affected `LanguageContext` and patches only the changed sections in `.context.md`, leaving unaffected sections and manual blocks intact.

**WASM tree-sitter** — Native tree-sitter bindings are unavailable on some platforms (e.g. darwin/x64 + Node 22). ContextForge uses `web-tree-sitter` (WASM) exclusively for portability. The parser pool is a singleton that initialises once and reuses grammar parsers across files.

**Convention confidence** — Each detected pattern carries `count/total` confidence. Patterns below 60% confidence are marked `contested: true` and their minority locations are recorded. This surfaces mid-migration codebases where two styles coexist.

**Decision store** — `.contextforge/decisions.jsonl` is append-only JSONL. The `log_decision` MCP tool writes to it; `get_relevant_context` searches it alongside `.context.md`.

**Manual blocks** — Sections wrapped in `<!-- contextforge:manual:start/end -->` are extracted before patching and re-inserted after. The patcher tracks their byte offsets and never writes inside them, regardless of what content they contain (including fake section tags).

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow — fork, clone, add upstream, open an issue, branch, write tests, and open a PR.

See also: [Code of Conduct](CODE_OF_CONDUCT.md) · [Security Policy](SECURITY.md)

---

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<table>
  <tr>
    <td align="center"><a href="https://github.com/beethovkjfe"><img src="https://avatars.githubusercontent.com/u/88784181?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Beethov KJ</b></sub></a></td>
    </tr>
    </table>
