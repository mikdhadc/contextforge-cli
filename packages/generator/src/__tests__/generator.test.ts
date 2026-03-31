import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { patchContextFile } from '../patcher.js';
import { wrapSection } from '../generator.js';
import { IDEFileWriter } from '../ide-writer.js';
import { parseContextFile } from '../parser.js';

describe('patcher: manual blocks survive patch cycles', () => {
  it('preserves manual block content across three patch cycles', () => {
    const manualContent = '<!-- contextforge:manual:start -->\nMy custom notes: never delete this!\n<!-- contextforge:manual:end -->';
    const initial = wrapSection('stack', 'hash001', '## Stack\nTypeScript') + '\n' + manualContent;

    const CUSTOM_TEXT = 'My custom notes: never delete this!';

    // Cycle 1
    const sections1 = new Map([['stack', wrapSection('stack', 'hash002', '## Stack\nTypeScript + Go')]]);
    const patched1 = patchContextFile(initial, sections1 as any);
    expect(patched1).toContain(CUSTOM_TEXT);

    // Cycle 2
    const sections2 = new Map([['stack', wrapSection('stack', 'hash003', '## Stack\nTypeScript + Go + Rust')]]);
    const patched2 = patchContextFile(patched1, sections2 as any);
    expect(patched2).toContain(CUSTOM_TEXT);

    // Cycle 3 — also add a new section
    const sections3 = new Map([
      ['stack', wrapSection('stack', 'hash004', '## Stack\nFull stack')],
      ['conventions', wrapSection('conventions', 'hash005', '## Conventions\ncamelCase')],
    ]);
    const patched3 = patchContextFile(patched2, sections3 as any);
    expect(patched3).toContain(CUSTOM_TEXT);
    expect(patched3).toContain('## Conventions');
  });

  it('does not modify content inside manual block even if it looks like a section', () => {
    const tricky = [
      wrapSection('stack', 'aaa', '## Stack\nJS'),
      '<!-- contextforge:manual:start -->',
      '<!-- contextforge:conventions:start hash="fake" -->',
      'This looks like a section but is inside manual block',
      '<!-- contextforge:conventions:end -->',
      '<!-- contextforge:manual:end -->',
    ].join('\n');

    const updated = new Map([['conventions', wrapSection('conventions', 'bbb', '## Conventions\nReal content')]]);
    const result = patchContextFile(tricky, updated as any);

    // Should add the real conventions section...
    expect(result).toContain('## Conventions\nReal content');
    // ...but keep the fake one inside manual block
    expect(result).toContain('This looks like a section but is inside manual block');
  });
});

describe('patcher: section replacement', () => {
  it('replaces existing section content', () => {
    const initial = wrapSection('stack', 'old', '## Stack\nOld content');
    const updated = new Map([['stack', wrapSection('stack', 'new', '## Stack\nNew content')]]);
    const result = patchContextFile(initial, updated as any);
    expect(result).toContain('New content');
    expect(result).not.toContain('Old content');
  });

  it('appends new sections when they do not exist', () => {
    const initial = wrapSection('stack', 'h1', '## Stack\nJS');
    const updated = new Map([['conventions', wrapSection('conventions', 'h2', '## Conventions\ncamelCase')]]);
    const result = patchContextFile(initial, updated as any);
    expect(result).toContain('## Stack');
    expect(result).toContain('## Conventions');
  });

  it('creates file with manual block when given empty content', () => {
    const sections = new Map([['stack', wrapSection('stack', 'h1', '## Stack\nJS')]]);
    const result = patchContextFile('', sections as any);
    expect(result).toContain('## Stack');
    expect(result).toContain('<!-- contextforge:manual:start -->');
    expect(result).toContain('<!-- contextforge:manual:end -->');
  });
});

describe('parser: parseContextFile', () => {
  it('parses sections and manual blocks correctly', () => {
    const raw = [
      '# Project Context\n',
      wrapSection('stack', 'abc', '## Stack\nJS'),
      wrapSection('conventions', 'def', '## Conventions\ncamelCase'),
      '<!-- contextforge:manual:start -->',
      'Custom content',
      '<!-- contextforge:manual:end -->',
    ].join('\n');

    const parsed = parseContextFile(raw);
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].name).toBe('stack');
    expect(parsed.sections[1].name).toBe('conventions');
    expect(parsed.manualBlocks).toHaveLength(1);
    expect(parsed.manualBlocks[0].content).toContain('Custom content');
  });

  it('returns empty sections and manualBlocks for empty input', () => {
    const parsed = parseContextFile('');
    expect(parsed.sections).toHaveLength(0);
    expect(parsed.manualBlocks).toHaveLength(0);
    expect(parsed.header).toBe('');
  });

  it('correctly identifies header text before sections', () => {
    const raw = '# Project Context\n\n> Some header text\n\n' + wrapSection('stack', 'abc', '## Stack\nJS');
    const parsed = parseContextFile(raw);
    expect(parsed.header).toBe('# Project Context\n\n> Some header text\n\n');
  });

  it('stores correct startIndex and endIndex for sections', () => {
    const section = wrapSection('stack', 'abc', '## Stack\nJS');
    const parsed = parseContextFile(section);
    expect(parsed.sections).toHaveLength(1);
    const s = parsed.sections[0];
    expect(s.startIndex).toBe(0);
    expect(s.endIndex).toBe(section.length);
    expect(parsed.raw.slice(s.startIndex, s.endIndex)).toBe(section);
  });
});

describe('IDEFileWriter', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-gen-test-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true }); });

  it('detects cursor IDE from .cursor/mcp.json', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.cursor', 'mcp.json'), '{}');
    const writer = new IDEFileWriter(tmpDir);
    expect(writer.detectIde()).toBe('cursor');
  });

  it('detects windsurf IDE from .windsurf/mcp.json', () => {
    fs.mkdirSync(path.join(tmpDir, '.windsurf'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.windsurf', 'mcp.json'), '{}');
    const writer = new IDEFileWriter(tmpDir);
    expect(writer.detectIde()).toBe('windsurf');
  });

  it('detects vscode IDE from .vscode/mcp.json', () => {
    fs.mkdirSync(path.join(tmpDir, '.vscode'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.vscode', 'mcp.json'), '{}');
    const writer = new IDEFileWriter(tmpDir);
    expect(writer.detectIde()).toBe('vscode');
  });

  it('detects claude-code IDE from .claude directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'settings.json'), '{}');
    const writer = new IDEFileWriter(tmpDir);
    expect(writer.detectIde()).toBe('claude-code');
  });

  it('returns null when no IDE detected', () => {
    const writer = new IDEFileWriter(tmpDir);
    // Ensure no env var
    const prev = process.env.CONTEXTFORGE_IDE;
    delete process.env.CONTEXTFORGE_IDE;
    expect(writer.detectIde()).toBeNull();
    if (prev !== undefined) process.env.CONTEXTFORGE_IDE = prev;
  });

  it('writes CLAUDE.md for claude-code', () => {
    const writer = new IDEFileWriter(tmpDir);
    writer.write('claude-code', '# Context\nHello');
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8')).toContain('Hello');
  });

  it('writes .cursorrules for cursor', () => {
    const writer = new IDEFileWriter(tmpDir);
    writer.write('cursor', '# Context\nHello');
    expect(fs.existsSync(path.join(tmpDir, '.cursorrules'))).toBe(true);
  });

  it('writes .windsurfrules for windsurf', () => {
    const writer = new IDEFileWriter(tmpDir);
    writer.write('windsurf', '# Context\nHello');
    expect(fs.existsSync(path.join(tmpDir, '.windsurfrules'))).toBe(true);
  });

  it('writes .github/copilot-instructions.md for vscode', () => {
    const writer = new IDEFileWriter(tmpDir);
    writer.write('vscode', '# Context\nHello');
    expect(fs.existsSync(path.join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true);
  });

  it('strips section delimiters when formatting for IDE', () => {
    const writer = new IDEFileWriter(tmpDir);
    const input = wrapSection('stack', 'abc', '## Stack\nTypeScript');
    const formatted = writer.formatForIde('cursor', input);
    expect(formatted).toContain('## Stack');
    expect(formatted).not.toContain('<!-- contextforge:');
  });

  it('strips manual block delimiters when formatting for IDE', () => {
    const writer = new IDEFileWriter(tmpDir);
    const input = '<!-- contextforge:manual:start -->\nMy notes\n<!-- contextforge:manual:end -->';
    const formatted = writer.formatForIde('claude-code', input);
    expect(formatted).toContain('My notes');
    expect(formatted).not.toContain('<!-- contextforge:manual:');
  });

  it('detects IDE from CONTEXTFORGE_IDE env var', () => {
    process.env.CONTEXTFORGE_IDE = 'windsurf';
    const writer = new IDEFileWriter(tmpDir);
    expect(writer.detectIde()).toBe('windsurf');
    delete process.env.CONTEXTFORGE_IDE;
  });

  it('ignores invalid CONTEXTFORGE_IDE env var values', () => {
    process.env.CONTEXTFORGE_IDE = 'invalid-ide';
    const writer = new IDEFileWriter(tmpDir);
    // Should fall through to file detection, which finds nothing
    expect(writer.detectIde()).toBeNull();
    delete process.env.CONTEXTFORGE_IDE;
  });

  it('returns correct target paths for each IDE', () => {
    const writer = new IDEFileWriter(tmpDir);
    expect(writer.getTargetPath('claude-code')).toBe(path.join(tmpDir, 'CLAUDE.md'));
    expect(writer.getTargetPath('cursor')).toBe(path.join(tmpDir, '.cursorrules'));
    expect(writer.getTargetPath('windsurf')).toBe(path.join(tmpDir, '.windsurfrules'));
    expect(writer.getTargetPath('vscode')).toBe(path.join(tmpDir, '.github', 'copilot-instructions.md'));
  });
});
