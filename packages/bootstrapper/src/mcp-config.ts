import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IdeTarget } from '@contextforge/generator';

/** The npx invocation that starts the ContextForge MCP server */
const MCP_SERVER_ENTRY = {
  command: 'npx',
  args: ['-y', 'contextforge-mcp'],
};

interface McpServerBlock {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** Returns the path where the IDE expects its MCP config */
export function getMcpConfigPath(ide: IdeTarget, projectRoot: string): string {
  switch (ide) {
    case 'claude-code': return path.join(projectRoot, '.mcp.json');
    case 'cursor':      return path.join(projectRoot, '.cursor', 'mcp.json');
    case 'windsurf':    return path.join(projectRoot, '.windsurf', 'mcp.json');
    case 'vscode':      return path.join(projectRoot, '.vscode', 'mcp.json');
    case 'antigravity': return path.join(projectRoot, '.antigravity', 'mcp.json');
  }
}

/**
 * Reads an existing MCP config (if any), merges the contextforge server entry
 * into it without disturbing other servers, then writes it back.
 *
 * Claude Code / Cursor / Windsurf / Antigravity use `{ mcpServers: { ... } }`.
 * VS Code uses `{ servers: { ... } }`.
 */
export function writeMcpConfig(ide: IdeTarget, projectRoot: string): string {
  const configPath = getMcpConfigPath(ide, projectRoot);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  // Read existing config or start fresh
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    } catch {
      // Corrupt JSON — overwrite
    }
  }

  const serverEntry: McpServerBlock = { ...MCP_SERVER_ENTRY };

  if (ide === 'vscode') {
    // VS Code uses "servers" key
    const servers = (existing.servers ?? {}) as Record<string, McpServerBlock>;
    existing.servers = { ...servers, contextforge: serverEntry };
  } else {
    // Claude Code, Cursor, Windsurf, Antigravity use "mcpServers"
    const mcpServers = (existing.mcpServers ?? {}) as Record<string, McpServerBlock>;
    existing.mcpServers = { ...mcpServers, contextforge: serverEntry };
  }

  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  return configPath;
}
