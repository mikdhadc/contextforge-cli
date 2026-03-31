import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IdeTarget } from './types.js';

export class IDEFileWriter {
  constructor(private readonly projectRoot: string) {}

  detectIde(): IdeTarget | null {
    // 1. Check env var
    const envIde = process.env.CONTEXTFORGE_IDE as IdeTarget | undefined;
    if (envIde && ['claude-code', 'cursor', 'windsurf', 'vscode', 'antigravity'].includes(envIde)) return envIde;

    // 2. Check config file presence
    if (fs.existsSync(path.join(this.projectRoot, '.cursor', 'mcp.json'))) return 'cursor';
    if (fs.existsSync(path.join(this.projectRoot, '.windsurf', 'mcp.json'))) return 'windsurf';
    if (fs.existsSync(path.join(this.projectRoot, '.vscode', 'mcp.json'))) return 'vscode';
    if (fs.existsSync(path.join(this.projectRoot, '.antigravity', 'mcp.json'))) return 'antigravity';
    if (fs.existsSync(path.join(this.projectRoot, '.claude'))) return 'claude-code';

    return null;
  }

  write(ide: IdeTarget, content: string): void {
    const filePath = this.getTargetPath(ide);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  getTargetPath(ide: IdeTarget): string {
    switch (ide) {
      case 'claude-code': return path.join(this.projectRoot, 'CLAUDE.md');
      case 'cursor': return path.join(this.projectRoot, '.cursorrules');
      case 'windsurf': return path.join(this.projectRoot, '.windsurfrules');
      case 'vscode': return path.join(this.projectRoot, '.github', 'copilot-instructions.md');
      case 'antigravity': return path.join(this.projectRoot, '.antigravity-context.md');
    }
  }

  formatForIde(ide: IdeTarget, contextContent: string): string {
    // Strip HTML comment delimiters for IDE consumption
    // Keep the Markdown content, remove the <!-- contextforge:...:start --> wrappers
    // Keep manual block content, remove manual block delimiters
    return contextContent
      .replace(/<!-- contextforge:[a-z-]+:start hash="[^"]*" -->\n?/g, '')
      .replace(/<!-- contextforge:[a-z-]+:end -->\n?/g, '')
      .replace(/<!-- contextforge:manual:start -->\n?/g, '')
      .replace(/<!-- contextforge:manual:end -->\n?/g, '');
  }
}
