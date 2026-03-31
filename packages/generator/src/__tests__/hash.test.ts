import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { sha256Short, computeSignatureHash } from '../hash.js';

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cf-hash-test-'));
}

describe('sha256Short', () => {
  it('returns exactly 8 hex characters', () => {
    const result = sha256Short('hello world');
    expect(result).toHaveLength(8);
    expect(result).toMatch(/^[a-f0-9]{8}$/);
  });

  it('is deterministic for the same input', () => {
    expect(sha256Short('abc')).toBe(sha256Short('abc'));
  });

  it('produces different output for different inputs', () => {
    expect(sha256Short('foo')).not.toBe(sha256Short('bar'));
  });

  it('handles empty string', () => {
    const result = sha256Short('');
    expect(result).toHaveLength(8);
    expect(result).toMatch(/^[a-f0-9]{8}$/);
  });
});

describe('computeSignatureHash', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmp(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns 8 hex characters for empty directory', () => {
    const result = computeSignatureHash(tmpDir);
    expect(result).toHaveLength(8);
    expect(result).toMatch(/^[a-f0-9]{8}$/);
  });

  it('is deterministic: same files produce same hash', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
    expect(computeSignatureHash(tmpDir)).toBe(computeSignatureHash(tmpDir));
  });

  it('changes when package.json content changes', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(pkgPath, '{"name":"v1"}');
    const before = computeSignatureHash(tmpDir);
    fs.writeFileSync(pkgPath, '{"name":"v2"}');
    const after = computeSignatureHash(tmpDir);
    expect(before).not.toBe(after);
  });

  it('changes when go.mod is added', () => {
    const before = computeSignatureHash(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/app\n\ngo 1.21\n');
    const after = computeSignatureHash(tmpDir);
    expect(before).not.toBe(after);
  });

  it('is stable when non-signature files change', () => {
    const before = computeSignatureHash(tmpDir);
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'util.ts'), 'export const x = 1;');
    // non-signature file — hash should not change
    const after = computeSignatureHash(tmpDir);
    expect(before).toBe(after);
  });
});
