import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { ChangeEvent } from '@contextforge/watcher';
import { ProjectWatcher } from '@contextforge/watcher';
import { ContextCache } from './context-cache.js';
import { PROJECT_ROOT, isContextFresh, runFullPipeline, runIncrementalPipeline } from './pipeline.js';
import { handleGetConventions } from './tools/get-conventions.js';
import { handleGetContext } from './tools/get-context.js';
import { handleEnrichPrompt } from './tools/enrich-prompt.js';
import { handleLogDecision } from './tools/log-decision.js';

// Singleton cache shared across all tool handlers
const cache = new ContextCache();

export function createServer(): McpServer {
  const server = new McpServer({ name: 'contextforge', version: '0.1.0' });

  server.registerTool(
    'get_project_conventions',
    {
      description: 'Returns all detected project conventions with confidence scores and contested flags',
    },
    async () => ({
      content: [{ type: 'text' as const, text: handleGetConventions(cache) }],
    }),
  );

  server.registerTool(
    'get_relevant_context',
    {
      description: 'Returns relevant context sections from .context.md for a given feature area',
      inputSchema: { feature_area: z.string().describe('The feature area or topic to get context for') },
    },
    async ({ feature_area }) => ({
      content: [{ type: 'text' as const, text: handleGetContext(feature_area, cache) }],
    }),
  );

  server.registerTool(
    'enrich_prompt',
    {
      description: 'Enriches a raw prompt with stack context, conventions, prior decisions, and anti-patterns',
      inputSchema: { raw_prompt: z.string().describe('The raw prompt to enrich') },
    },
    async ({ raw_prompt }) => ({
      content: [{ type: 'text' as const, text: handleEnrichPrompt(raw_prompt, cache) }],
    }),
  );

  server.registerTool(
    'log_decision',
    {
      description: 'Logs an architectural decision to .contextforge/decisions.jsonl',
      inputSchema: {
        topic:     z.string().describe('The decision topic'),
        decision:  z.string().describe('The decision made'),
        rationale: z.string().describe('The rationale for the decision'),
      },
    },
    async ({ topic, decision, rationale }) => ({
      content: [{ type: 'text' as const, text: handleLogDecision(PROJECT_ROOT, topic, decision, rationale) }],
    }),
  );

  return server;
}

export async function startServer(): Promise<void> {
  // 1. Run pipeline if context is stale or missing
  if (!isContextFresh(PROJECT_ROOT)) {
    process.stderr.write('[contextforge] Context stale or missing — running pipeline...\n');
    await runFullPipeline(PROJECT_ROOT, cache);
    process.stderr.write('[contextforge] Pipeline complete.\n');
  } else {
    // Load existing results into cache by running detection only (fast, no WASM)
    // We don't re-scan conventions when fresh — just populate the cache
    process.stderr.write('[contextforge] Context is fresh.\n');
    // Note: cache will be empty until first full pipeline; tools gracefully handle null cache
  }

  // 2. Start watcher
  const watcher = new ProjectWatcher(PROJECT_ROOT);
  watcher.on('change', async (event: ChangeEvent) => {
    process.stderr.write(`[contextforge] Change detected: ${event.category} at ${event.path}\n`);
    await runIncrementalPipeline(PROJECT_ROOT, event.path, cache);
  });
  await watcher.start();

  // 3. Connect MCP transport
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
