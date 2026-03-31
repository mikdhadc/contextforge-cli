import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { renderAllSections } from '../renderer.js';
import type { GeneratorInput } from '../types.js';
import type { DetectionResult, ConventionResult } from '@contextforge/scanner';

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cf-renderer-test-'));
}

function makeInput(projectRoot: string, overrides: Partial<GeneratorInput> = {}): GeneratorInput {
  const detection: DetectionResult = {
    projectRoot,
    isPolyglot: false,
    languages: [{
      language: 'typescript',
      root: projectRoot,
      frameworks: ['next.js'],
      packageManager: 'pnpm',
      isMonorepo: false,
      signatureFiles: ['package.json'],
    }],
  };
  const conventions: ConventionResult = new Map();
  return { projectRoot, detection, conventions, ...overrides };
}

describe('renderAllSections', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmp(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns all 6 section keys', () => {
    const sections = renderAllSections(makeInput(tmpDir));
    expect([...sections.keys()]).toEqual(
      expect.arrayContaining(['stack', 'structure', 'conventions', 'dependencies', 'anti-patterns', 'decisions']),
    );
    expect(sections.size).toBe(6);
  });

  it('each section has content and inputHash', () => {
    const sections = renderAllSections(makeInput(tmpDir));
    for (const [, { content, inputHash }] of sections) {
      expect(typeof content).toBe('string');
      expect(inputHash).toHaveLength(8);
      expect(inputHash).toMatch(/^[a-f0-9]{8}$/);
    }
  });

  it('stack section includes the detected language', () => {
    const sections = renderAllSections(makeInput(tmpDir));
    const stack = sections.get('stack')!.content;
    expect(stack).toContain('Typescript');
  });

  it('stack section includes frameworks', () => {
    const sections = renderAllSections(makeInput(tmpDir));
    const stack = sections.get('stack')!.content;
    expect(stack).toContain('Next.js');
  });

  it('stack section includes package manager', () => {
    const sections = renderAllSections(makeInput(tmpDir));
    const stack = sections.get('stack')!.content;
    expect(stack).toContain('pnpm');
  });

  it('decisions section shows placeholder when decisions.jsonl absent', () => {
    const sections = renderAllSections(makeInput(tmpDir));
    const decisions = sections.get('decisions')!.content;
    expect(decisions).toContain('No decisions logged yet');
  });

  it('decisions section renders entries from decisions.jsonl', () => {
    const cfDir = path.join(tmpDir, '.contextforge');
    fs.mkdirSync(cfDir, { recursive: true });
    fs.writeFileSync(
      path.join(cfDir, 'decisions.jsonl'),
      JSON.stringify({ decision: 'Use pnpm workspaces', context: 'Monorepo setup' }) + '\n',
    );
    const sections = renderAllSections(makeInput(tmpDir));
    const decisions = sections.get('decisions')!.content;
    expect(decisions).toContain('Use pnpm workspaces');
  });

  it('anti-patterns section always has a placeholder (static)', () => {
    const sections = renderAllSections(makeInput(tmpDir));
    const ap = sections.get('anti-patterns')!.content;
    expect(ap).toContain('Anti-Patterns');
  });

  it('isPolyglot project renders multiple language headings in stack', () => {
    const input = makeInput(tmpDir, {
      detection: {
        projectRoot: tmpDir,
        isPolyglot: true,
        languages: [
          { language: 'typescript', root: tmpDir, frameworks: [], packageManager: 'pnpm', isMonorepo: false, signatureFiles: [] },
          { language: 'go', root: path.join(tmpDir, 'backend'), frameworks: ['gin'], packageManager: null, isMonorepo: false, signatureFiles: [] },
        ],
      },
    });
    const sections = renderAllSections(input);
    const stack = sections.get('stack')!.content;
    expect(stack).toContain('Typescript');
    expect(stack).toContain('Go');
    expect(stack).toContain('Gin');
  });
});
