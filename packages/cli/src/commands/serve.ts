import { Command } from 'commander';
import { startServer } from '@contextforge/mcp';

export async function runServe(): Promise<void> {
  await startServer();
}

export function serveCommand(): Command {
  return new Command('serve')
    .description('Start the ContextForge MCP server (stdio transport)')
    .action(() => runServe());
}
