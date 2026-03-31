import * as fs from 'node:fs';
import * as path from 'node:path';
import { IDEFileWriter } from '@contextforge/generator';
import type { IdeTarget } from '@contextforge/generator';
import { writeMcpConfig } from './mcp-config.js';

const CF_DIR = '.contextforge';
const CONFIG_FILE = 'config.json';
const DECISIONS_FILE = 'decisions.jsonl';

export interface BootstrapConfig {
  ide: IdeTarget | null;
  version: string;
  initializedAt: string;
}

export interface BootstrapResult {
  projectRoot: string;
  ide: IdeTarget | null;
  /** Files created or updated during bootstrap */
  written: string[];
  /** True when .contextforge/config.json already existed before this run */
  alreadyBootstrapped: boolean;
}

/** Returns true if the project has already been bootstrapped */
export function isBootstrapped(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, CF_DIR, CONFIG_FILE));
}

/**
 * One-time project setup: creates the .contextforge/ directory, writes
 * config.json and decisions.jsonl, and registers the MCP server with the
 * detected (or provided) IDE.
 *
 * Idempotent: safe to call multiple times. Existing files are never overwritten
 * unless `force` is true.
 */
export function bootstrap(projectRoot: string, opts: { ide?: IdeTarget; force?: boolean } = {}): BootstrapResult {
  const written: string[] = [];
  const alreadyBootstrapped = isBootstrapped(projectRoot);

  // 1. Resolve IDE
  const ideWriter = new IDEFileWriter(projectRoot);
  if (opts.ide) {
    process.env.CONTEXTFORGE_IDE = opts.ide;
  }
  const ide = ideWriter.detectIde();

  // 2. Create .contextforge/ directory
  const cfDir = path.join(projectRoot, CF_DIR);
  fs.mkdirSync(cfDir, { recursive: true });

  // 3. Write config.json (skip if exists and not forced)
  const configPath = path.join(cfDir, CONFIG_FILE);
  if (!fs.existsSync(configPath) || opts.force) {
    const config: BootstrapConfig = {
      ide,
      version: '0.1.0',
      initializedAt: new Date().toISOString(),
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    written.push(configPath);
  }

  // 4. Create empty decisions.jsonl if absent
  const decisionsPath = path.join(cfDir, DECISIONS_FILE);
  if (!fs.existsSync(decisionsPath)) {
    fs.writeFileSync(decisionsPath, '', 'utf8');
    written.push(decisionsPath);
  }

  // 5. Write MCP server config for detected IDE
  if (ide) {
    const mcpPath = writeMcpConfig(ide, projectRoot);
    written.push(mcpPath);
  }

  return { projectRoot, ide, written, alreadyBootstrapped };
}
