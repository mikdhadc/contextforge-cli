# Changelog

All notable changes to ContextForge are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Interactive IDE selection prompt in `contextforge init` when `--ide` flag is not provided
- Interactive template application prompt in `contextforge init` when `--templates` flag is not provided
- Interactive `.gitignore` prompt in `contextforge init` when `--gitignore` flag is not provided
- `--templates` flag for non-interactive template application during `init`
- `--gitignore` flag for non-interactive `.gitignore` update during `init`
- `.contextforge/` and `.mcp.json` are now tracked and added to `.gitignore` when requested
- Antigravity IDE support (`--ide antigravity`) — writes `.antigravity-context.md` and `.antigravity/mcp.json`
- Open source community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- GitHub issue templates for bug reports, feature requests, and documentation
- GitHub pull request template

### Changed
- `contextforge init` now includes template application as part of the initialization flow
- README updated with Antigravity IDE, new `init` flags, and contributors section

---

## [0.1.0] — Initial Release

### Added
- `contextforge init` — full bootstrap, scan, and context generation
- `contextforge serve` — MCP stdio server
- `contextforge status` — context freshness and section summary
- `contextforge switch <ide>` — re-write IDE file without re-scanning
- `contextforge audit` — health check with `--json` and `--fix` flags
- `contextforge templates list` — list built-in slash command templates
- `contextforge templates apply` — write templates to IDE command directory
- Five built-in slash command templates: `feature`, `bugfix`, `refactor`, `review`, `explain`
- IDE support: Claude Code, Cursor, Windsurf, VS Code
- MCP tools: `get_project_conventions`, `get_relevant_context`, `enrich_prompt`, `log_decision`
- AST-based convention detection via web-tree-sitter (WASM) for TypeScript, JavaScript, Python, Go, Rust, PHP, Ruby
- Convention confidence scoring with contested flag detection
- Incremental context pipeline — only changed sections are rewritten
- Manual block protection — `<!-- contextforge:manual:start/end -->` content is never overwritten
- Docker multi-stage image for containerised MCP server deployment
- GitHub Actions CI — Node 20 + 22 matrix, build, test, publish on `v*` tags
