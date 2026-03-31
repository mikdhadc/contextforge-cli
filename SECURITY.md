# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (main) | Yes |
| older releases | No — please upgrade |

---

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it privately so we can address it before it is publicly disclosed.

### How to report

1. Go to the repository's **Security** tab on GitHub
2. Click **Report a vulnerability** (GitHub private security advisories)
3. Fill in the details — what the vulnerability is, how to reproduce it, and what the potential impact is

Alternatively, email the maintainer directly. Contact details are in the repository's GitHub profile.

### What to include

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept code or commands if applicable)
- Affected version(s) or package(s)
- Any suggested mitigation or fix if you have one

### What to expect

- **Acknowledgement** within 48 hours of your report
- **Status update** within 5 business days — whether we can reproduce it and our plan
- **Resolution** — we aim to patch critical vulnerabilities within 14 days and disclose publicly once a fix is released

We will credit you in the release notes unless you prefer to remain anonymous.

---

## Scope

This policy covers all packages published under the `contextforge` and `contextforge-*` npm namespace originating from this repository:

- `contextforge` (CLI)
- `contextforge-mcp` (MCP server)
- `@contextforge/scanner`
- `@contextforge/generator`
- `@contextforge/watcher`
- `@contextforge/bootstrapper`

### In scope

- Remote code execution via the CLI or MCP server
- Arbitrary file write/read outside the declared project root
- MCP tool responses that leak unintended data from the host filesystem
- Dependency vulnerabilities with a direct exploit path in ContextForge's use

### Out of scope

- Vulnerabilities in the user's project that ContextForge scans (ContextForge reads but does not execute scanned code)
- Issues requiring physical access to the machine
- Social engineering attacks

---

## Security Design Notes

ContextForge operates entirely locally — no data is sent to remote servers. The MCP server communicates over stdio only and never opens a network port. The scanner reads files from the declared `PROJECT_ROOT` and does not follow symlinks outside that directory.
