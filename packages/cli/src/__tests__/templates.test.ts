import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runTemplatesList, runTemplatesApply, BUILTIN_TEMPLATES } from '../commands/templates.js';
import { TEMPLATE_CONTENT } from '../templates/content.js';
import { writeTemplate, getIdeTemplateConfig } from '../templates/writer.js';

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cf-tpl-test-'));
}

describe('TEMPLATE_CONTENT', () => {
  it('has an entry for every builtin template', () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(TEMPLATE_CONTENT[t.name], `Missing content for "${t.name}"`).toBeDefined();
    }
  });

  it('every template body contains $ARGUMENTS', () => {
    for (const [name, body] of Object.entries(TEMPLATE_CONTENT)) {
      expect(body, `"${name}" missing $ARGUMENTS`).toContain('$ARGUMENTS');
    }
  });

  it('feature template mentions get_relevant_context', () => {
    expect(TEMPLATE_CONTENT.feature).toContain('get_relevant_context');
  });

  it('bugfix template mentions log_decision', () => {
    expect(TEMPLATE_CONTENT.bugfix).toContain('log_decision');
  });

  it('refactor template mentions contested conventions', () => {
    expect(TEMPLATE_CONTENT.refactor).toContain('contested');
  });

  it('review template includes naming checklist item', () => {
    expect(TEMPLATE_CONTENT.review).toContain('naming');
  });
});

describe('getIdeTemplateConfig', () => {
  const root = '/project';

  it('claude-code uses .claude/commands with .md extension', () => {
    const cfg = getIdeTemplateConfig('claude-code', root);
    expect(cfg.dir).toBe('/project/.claude/commands');
    expect(cfg.ext).toBe('.md');
    expect(cfg.preamble).toBeUndefined();
  });

  it('cursor uses .cursor/rules with .mdc extension and frontmatter', () => {
    const cfg = getIdeTemplateConfig('cursor', root);
    expect(cfg.dir).toBe('/project/.cursor/rules');
    expect(cfg.ext).toBe('.mdc');
    expect(cfg.preamble).toContain('---');
  });

  it('windsurf uses .windsurf/rules with .md extension', () => {
    const cfg = getIdeTemplateConfig('windsurf', root);
    expect(cfg.dir).toBe('/project/.windsurf/rules');
    expect(cfg.ext).toBe('.md');
  });

  it('vscode uses .github/instructions with .instructions.md extension', () => {
    const cfg = getIdeTemplateConfig('vscode', root);
    expect(cfg.dir).toBe('/project/.github/instructions');
    expect(cfg.ext).toBe('.instructions.md');
    expect(cfg.preamble).toContain('applyTo');
  });
});

describe('writeTemplate', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmp(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('writes feature.md to .claude/commands for claude-code', () => {
    const result = writeTemplate('feature', TEMPLATE_CONTENT.feature, 'claude-code', tmpDir);
    expect(result.filePath).toContain('.claude/commands/feature.md');
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  it('writes feature.mdc to .cursor/rules for cursor', () => {
    const result = writeTemplate('feature', TEMPLATE_CONTENT.feature, 'cursor', tmpDir);
    expect(result.filePath).toContain('.cursor/rules/feature.mdc');
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  it('cursor file starts with frontmatter', () => {
    const result = writeTemplate('feature', TEMPLATE_CONTENT.feature, 'cursor', tmpDir);
    const content = fs.readFileSync(result.filePath, 'utf8');
    expect(content.startsWith('---')).toBe(true);
  });

  it('claude-code file does not get frontmatter prepended', () => {
    const result = writeTemplate('feature', TEMPLATE_CONTENT.feature, 'claude-code', tmpDir);
    const content = fs.readFileSync(result.filePath, 'utf8');
    expect(content.startsWith('---')).toBe(false);
    expect(content).toContain('# Feature');
  });

  it('vscode file has applyTo frontmatter', () => {
    const result = writeTemplate('review', TEMPLATE_CONTENT.review, 'vscode', tmpDir);
    const content = fs.readFileSync(result.filePath, 'utf8');
    expect(content).toContain('applyTo');
  });

  it('creates parent directories if they do not exist', () => {
    writeTemplate('bugfix', TEMPLATE_CONTENT.bugfix, 'claude-code', tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'commands'))).toBe(true);
  });
});

describe('runTemplatesApply', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmp(); });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a single named template with explicit --ide', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    runTemplatesApply('feature', { ide: 'claude-code', root: tmpDir });
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'commands', 'feature.md'))).toBe(true);
  });

  it('writes all templates when --all is set', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    runTemplatesApply(undefined, { ide: 'claude-code', root: tmpDir, all: true });
    for (const t of BUILTIN_TEMPLATES) {
      expect(
        fs.existsSync(path.join(tmpDir, '.claude', 'commands', `${t.name}.md`)),
        `Missing ${t.name}.md`,
      ).toBe(true);
    }
  });

  it('exits 1 for unknown template name', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    runTemplatesApply('nonexistent', { ide: 'claude-code', root: tmpDir });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when no IDE detected and no --ide flag', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // tmpDir has no IDE config files, no env var
    delete process.env.CONTEXTFORGE_IDE;
    runTemplatesApply('feature', { root: tmpDir });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when no name and no --all', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    runTemplatesApply(undefined, { ide: 'claude-code', root: tmpDir });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
