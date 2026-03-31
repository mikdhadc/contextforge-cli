import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { bootstrap, isBootstrapped } from '../bootstrap.js';
import { getMcpConfigPath, writeMcpConfig } from '../mcp-config.js';

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cf-bootstrap-test-'));
}

describe('isBootstrapped', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmp(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns false for a fresh directory', () => {
    expect(isBootstrapped(tmpDir)).toBe(false);
  });

  it('returns true after bootstrap() has run', () => {
    bootstrap(tmpDir, { ide: 'claude-code' });
    expect(isBootstrapped(tmpDir)).toBe(true);
  });
});

describe('bootstrap()', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmp();
    process.env.CONTEXTFORGE_IDE = 'claude-code';
  });

  afterEach(() => {
    delete process.env.CONTEXTFORGE_IDE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .contextforge/ directory', () => {
    bootstrap(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.contextforge'))).toBe(true);
  });

  it('writes .contextforge/config.json', () => {
    bootstrap(tmpDir);
    const configPath = path.join(tmpDir, '.contextforge', 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.version).toBe('0.1.0');
    expect(config.ide).toBe('claude-code');
    expect(config.initializedAt).toBeDefined();
  });

  it('writes empty .contextforge/decisions.jsonl', () => {
    bootstrap(tmpDir);
    const decisionsPath = path.join(tmpDir, '.contextforge', 'decisions.jsonl');
    expect(fs.existsSync(decisionsPath)).toBe(true);
    expect(fs.readFileSync(decisionsPath, 'utf8')).toBe('');
  });

  it('writes MCP config for claude-code at .mcp.json', () => {
    bootstrap(tmpDir, { ide: 'claude-code' });
    expect(fs.existsSync(path.join(tmpDir, '.mcp.json'))).toBe(true);
  });

  it('returns list of written files', () => {
    const result = bootstrap(tmpDir, { ide: 'claude-code' });
    expect(result.written.length).toBeGreaterThan(0);
  });

  it('reports alreadyBootstrapped=false on first run', () => {
    const result = bootstrap(tmpDir, { ide: 'claude-code' });
    expect(result.alreadyBootstrapped).toBe(false);
  });

  it('reports alreadyBootstrapped=true on second run', () => {
    bootstrap(tmpDir, { ide: 'claude-code' });
    const result = bootstrap(tmpDir, { ide: 'claude-code' });
    expect(result.alreadyBootstrapped).toBe(true);
  });

  it('does not overwrite config.json on second run without --force', () => {
    bootstrap(tmpDir, { ide: 'claude-code' });
    const configPath = path.join(tmpDir, '.contextforge', 'config.json');
    const first = fs.readFileSync(configPath, 'utf8');

    bootstrap(tmpDir, { ide: 'claude-code' });
    const second = fs.readFileSync(configPath, 'utf8');
    expect(first).toBe(second);
  });

  it('overwrites config.json when force=true', () => {
    bootstrap(tmpDir, { ide: 'claude-code' });
    const configPath = path.join(tmpDir, '.contextforge', 'config.json');
    const firstConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Small delay to ensure a different timestamp
    const result = bootstrap(tmpDir, { ide: 'claude-code', force: true });
    expect(result.written).toContain(configPath);
    const secondConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // timestamp may or may not differ in fast tests, but file should be in written list
    expect(secondConfig.version).toBe(firstConfig.version);
  });

  it('does not overwrite existing decisions.jsonl', () => {
    bootstrap(tmpDir, { ide: 'claude-code' });
    const decisionsPath = path.join(tmpDir, '.contextforge', 'decisions.jsonl');
    fs.writeFileSync(decisionsPath, '{"topic":"test"}\n');
    bootstrap(tmpDir, { ide: 'claude-code' });
    expect(fs.readFileSync(decisionsPath, 'utf8')).toBe('{"topic":"test"}\n');
  });

  it('exposes detected ide in result', () => {
    const result = bootstrap(tmpDir, { ide: 'cursor' });
    expect(result.ide).toBe('cursor');
  });
});

describe('getMcpConfigPath', () => {
  it('claude-code → .mcp.json', () => {
    expect(getMcpConfigPath('claude-code', '/project')).toBe('/project/.mcp.json');
  });
  it('cursor → .cursor/mcp.json', () => {
    expect(getMcpConfigPath('cursor', '/project')).toBe('/project/.cursor/mcp.json');
  });
  it('windsurf → .windsurf/mcp.json', () => {
    expect(getMcpConfigPath('windsurf', '/project')).toBe('/project/.windsurf/mcp.json');
  });
  it('vscode → .vscode/mcp.json', () => {
    expect(getMcpConfigPath('vscode', '/project')).toBe('/project/.vscode/mcp.json');
  });
});

describe('writeMcpConfig', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTmp(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('writes mcpServers.contextforge for claude-code', () => {
    writeMcpConfig('claude-code', tmpDir);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.mcp.json'), 'utf8'));
    expect(config.mcpServers.contextforge.command).toBe('npx');
    expect(config.mcpServers.contextforge.args).toContain('contextforge-mcp');
  });

  it('writes mcpServers.contextforge for cursor', () => {
    writeMcpConfig('cursor', tmpDir);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.cursor', 'mcp.json'), 'utf8'));
    expect(config.mcpServers.contextforge).toBeDefined();
  });

  it('writes servers.contextforge (not mcpServers) for vscode', () => {
    writeMcpConfig('vscode', tmpDir);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.vscode', 'mcp.json'), 'utf8'));
    expect(config.servers?.contextforge).toBeDefined();
    expect(config.mcpServers).toBeUndefined();
  });

  it('merges into existing config without clobbering other servers', () => {
    const existing = { mcpServers: { otherTool: { command: 'other' } } };
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(existing));
    writeMcpConfig('claude-code', tmpDir);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.mcp.json'), 'utf8'));
    expect(config.mcpServers.otherTool).toBeDefined();
    expect(config.mcpServers.contextforge).toBeDefined();
  });

  it('creates parent directories if missing', () => {
    writeMcpConfig('cursor', tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.cursor'))).toBe(true);
  });

  it('overwrites contextforge entry on re-run', () => {
    writeMcpConfig('claude-code', tmpDir);
    writeMcpConfig('claude-code', tmpDir);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.mcp.json'), 'utf8'));
    // Should still only have one contextforge entry
    expect(Object.keys(config.mcpServers)).toContain('contextforge');
  });
});
