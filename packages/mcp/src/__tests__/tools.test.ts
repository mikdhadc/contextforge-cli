import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import type { DetectionResult, ConventionResult, ConventionOccurrence, LanguageContext } from '@contextforge/scanner';
import { ContextCache } from '../context-cache.js';
import { DecisionStore } from '../decision-store.js';
import { handleGetConventions } from '../tools/get-conventions.js';
import { handleGetContext } from '../tools/get-context.js';
import { handleEnrichPrompt } from '../tools/enrich-prompt.js';
import { handleLogDecision } from '../tools/log-decision.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const tmpDirs: string[] = [];

function makeTmpProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-test-'));
  tmpDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return dir;
}

function makeCache(
  projectRoot: string,
  detection: DetectionResult,
  conventions: ConventionResult,
): ContextCache {
  const cache = new ContextCache();
  cache.set({
    projectRoot,
    detection,
    conventions,
    contextMdPath: path.join(projectRoot, '.context.md'),
    lastRunAt: new Date(),
  });
  return cache;
}

function makeOccurrence(
  pattern: string,
  confidence: number,
  minorities?: Array<{ pattern: string; count: number; locations: string[] }>,
): ConventionOccurrence {
  const total = 100;
  const count = Math.round(confidence * total);
  return {
    pattern,
    count,
    total,
    confidence,
    contested: confidence < 0.6,
    minority: minorities ?? [],
  };
}

function makeDetection(projectRoot: string, langRoot?: string): DetectionResult {
  const root = langRoot ?? projectRoot;
  const langCtx: LanguageContext = {
    language: 'javascript',
    root,
    frameworks: [],
    packageManager: 'npm',
    isMonorepo: false,
    signatureFiles: ['package.json'],
  };
  return {
    projectRoot,
    languages: [langCtx],
    isPolyglot: false,
  };
}

function makeConventionResult(
  root: string,
  overrides: Partial<{
    functions: ConventionOccurrence | null;
    classes: ConventionOccurrence | null;
    variables: ConventionOccurrence | null;
    constants: ConventionOccurrence | null;
  }> = {},
): ConventionResult {
  const result: ConventionResult = new Map();
  result.set(root, {
    naming: {
      functions: overrides.functions ?? makeOccurrence('camelCase', 0.85),
      classes: overrides.classes ?? makeOccurrence('PascalCase', 0.90),
      variables: overrides.variables ?? makeOccurrence('camelCase', 0.80),
      constants: overrides.constants ?? makeOccurrence('UPPER_CASE', 0.75),
    },
    imports: { dominant: makeOccurrence('named', 0.70) },
    exports: { dominant: makeOccurrence('named', 0.65) },
    tests: { filePattern: makeOccurrence('.test.ts', 0.80), framework: 'vitest' },
    folderStructure: { sourceDir: 'src', testDir: '__tests__', hasConfigDir: true },
  });
  return result;
}

/** Build a minimal .context.md with contextforge section markers */
function makeContextMd(sections: Record<string, string>): string {
  const lines: string[] = ['# Project Context\n'];
  for (const [name, content] of Object.entries(sections)) {
    lines.push(`<!-- contextforge:${name}:start hash="abc123" -->`);
    lines.push(content);
    lines.push(`<!-- contextforge:${name}:end -->`);
    lines.push('');
  }
  return lines.join('\n');
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleGetConventions', () => {
  it('Test 1: returns camelCase function naming convention', () => {
    const dir = makeTmpProject({ 'index.js': 'function helloWorld() {}' });
    const detection = makeDetection(dir);
    const conventions = makeConventionResult(dir);
    const cache = makeCache(dir, detection, conventions);

    const result = handleGetConventions(cache);

    expect(result).toContain('Function naming: camelCase');
  });

  it('Test 2: surfaces contested conventions with warning', () => {
    const dir = makeTmpProject({ 'index.js': '' });
    const detection = makeDetection(dir);
    const conventions = makeConventionResult(dir, {
      functions: makeOccurrence('camelCase', 0.55, [
        { pattern: 'snake_case', count: 45, locations: ['utils.js', 'helpers.js'] },
      ]),
    });
    const cache = makeCache(dir, detection, conventions);

    const result = handleGetConventions(cache);

    expect(result).toContain('⚠ Contested');
  });

  it('Test 3: returns "No scan results" message when cache is empty', () => {
    const cache = new ContextCache();

    const result = handleGetConventions(cache);

    expect(result).toContain('No scan results');
  });
});

describe('handleGetContext', () => {
  it('Test 4: keyword match in .context.md section', () => {
    const dir = makeTmpProject({
      '.context.md': makeContextMd({
        stack: 'This project uses JWT for authentication and Express.js.',
        conventions: 'Use camelCase for all function names.',
      }),
    });
    const detection = makeDetection(dir);
    const conventions = makeConventionResult(dir);
    const cache = makeCache(dir, detection, conventions);

    const result = handleGetContext('authentication', cache);

    expect(result).toContain('JWT');
    expect(result).toContain('authentication');
  });

  it('Test 5: keyword match in decisions.jsonl', () => {
    const dir = makeTmpProject({});
    const store = new DecisionStore(dir);
    store.append({
      topic: 'Database choice',
      decision: 'Use PostgreSQL',
      rationale: 'We need relational data with JSONB support',
    });

    const detection = makeDetection(dir);
    const conventions = makeConventionResult(dir);
    const cache = makeCache(dir, detection, conventions);

    const result = handleGetContext('database', cache);

    expect(result).toContain('PostgreSQL');
    expect(result).toContain('Database choice');
  });

  it('Test 6: no match returns "No context found" message', () => {
    const dir = makeTmpProject({
      '.context.md': makeContextMd({ stack: 'This project uses TypeScript.' }),
    });
    const detection = makeDetection(dir);
    const conventions = makeConventionResult(dir);
    const cache = makeCache(dir, detection, conventions);

    const result = handleGetContext('xyznonexistenttopic', cache);

    expect(result).toContain('No context found');
  });
});

describe('handleEnrichPrompt', () => {
  it('Test 7: basic enrichment contains required sections', () => {
    const dir = makeTmpProject({
      '.context.md': makeContextMd({
        stack: 'Node.js, Express, PostgreSQL',
        conventions: 'Use camelCase for functions',
      }),
    });
    const detection = makeDetection(dir);
    const conventions = makeConventionResult(dir);
    const cache = makeCache(dir, detection, conventions);

    const result = handleEnrichPrompt('add user authentication', cache);

    expect(result).toContain('Intent:');
    expect(result).toContain('Original prompt');
    // Should have either "Stack Context" or "Applicable Conventions"
    const hasSomeContext =
      result.includes('Stack Context') || result.includes('Applicable Conventions');
    expect(hasSomeContext).toBe(true);
  });

  it('Test 8: contested conventions are surfaced in enriched prompt', () => {
    const dir = makeTmpProject({});
    const detection = makeDetection(dir);
    const conventions = makeConventionResult(dir, {
      functions: makeOccurrence('camelCase', 0.55, [
        { pattern: 'snake_case', count: 45, locations: ['a.js', 'b.js'] },
      ]),
    });
    const cache = makeCache(dir, detection, conventions);

    const result = handleEnrichPrompt('refactor utility functions', cache);

    expect(result).toContain('⚠ **Contested**');
  });
});

describe('handleLogDecision', () => {
  it('Test 9: appends decision to decisions.jsonl', () => {
    const dir = makeTmpProject({});

    handleLogDecision(dir, 'auth', 'Use JWT', 'stateless');

    const jsonlPath = path.join(dir, '.contextforge', 'decisions.jsonl');
    expect(fs.existsSync(jsonlPath)).toBe(true);
    const content = fs.readFileSync(jsonlPath, 'utf8');
    const parsed = JSON.parse(content.trim());
    expect(parsed.topic).toBe('auth');
    expect(parsed.decision).toBe('Use JWT');
    expect(parsed.rationale).toBe('stateless');
    expect(parsed.timestamp).toBeTruthy();
  });

  it('Test 10: multiple decisions are queryable by keyword', () => {
    const dir = makeTmpProject({});

    handleLogDecision(dir, 'auth', 'Use JWT', 'stateless tokens');
    handleLogDecision(dir, 'caching', 'Use Redis', 'fast in-memory cache');

    const store = new DecisionStore(dir);
    const results = store.query(['JWT']);

    expect(results).toHaveLength(1);
    expect(results[0].topic).toBe('auth');
    expect(results[0].decision).toBe('Use JWT');
  });
});

describe('DecisionStore', () => {
  it('Test 11: query is case-insensitive', () => {
    const dir = makeTmpProject({});
    const store = new DecisionStore(dir);
    store.append({ topic: 'Authentication', decision: 'Use OAuth2', rationale: 'industry standard' });

    const results = store.query(['authentication']);

    expect(results).toHaveLength(1);
    expect(results[0].topic).toBe('Authentication');
  });

  it('Test 12: readAll on missing file returns empty array', () => {
    const dir = makeTmpProject({});
    // Do not create the decisions.jsonl file
    const store = new DecisionStore(dir);

    const results = store.readAll();

    expect(results).toEqual([]);
  });
});
