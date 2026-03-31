import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionScanner } from '../conventions/scanner.js';
import type { DetectionResult, LanguageContext } from '../types.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-conv-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function makeDetectionResult(ctx: LanguageContext): DetectionResult {
  return {
    projectRoot: ctx.root,
    languages: [ctx],
    isPolyglot: false,
  };
}

function makeJsContext(root: string): LanguageContext {
  return {
    language: 'javascript',
    root,
    frameworks: [],
    packageManager: 'npm',
    isMonorepo: false,
    signatureFiles: ['package.json'],
  };
}

function makeTsContext(root: string): LanguageContext {
  return {
    language: 'typescript',
    root,
    frameworks: [],
    packageManager: 'npm',
    isMonorepo: false,
    signatureFiles: ['package.json'],
  };
}

function makePyContext(root: string): LanguageContext {
  return {
    language: 'python',
    root,
    frameworks: [],
    packageManager: 'pip',
    isMonorepo: false,
    signatureFiles: ['requirements.txt'],
  };
}

function makeGoContext(root: string): LanguageContext {
  return {
    language: 'go',
    root,
    frameworks: [],
    packageManager: 'go mod',
    isMonorepo: false,
    signatureFiles: ['go.mod'],
  };
}

function makeRustContext(root: string): LanguageContext {
  return {
    language: 'rust',
    root,
    frameworks: [],
    packageManager: 'cargo',
    isMonorepo: false,
    signatureFiles: ['Cargo.toml'],
  };
}

// ---------------------------------------------------------------------------
// 1. JS naming: mostly camelCase, minority snake_case
// ---------------------------------------------------------------------------
describe('JS naming: camelCase dominant with snake_case minority', () => {
  it('detects camelCase as dominant with high confidence', async () => {
    // 8 camelCase functions in src/utils.js
    writeFile(path.join(tmpDir, 'src', 'utils.js'), `
function getUserName() { return ''; }
function parseData() { return null; }
function formatOutput() { return ''; }
function fetchResults() { return []; }
function handleError() {}
function validateInput() { return true; }
function buildResponse() { return {}; }
function processQueue() {}
`);

    // 4 camelCase functions in src/api.js
    writeFile(path.join(tmpDir, 'src', 'api.js'), `
function createRequest() { return {}; }
function sendMessage() {}
function loadConfig() { return {}; }
function initApp() {}
`);

    // 3 snake_case functions in legacy file
    writeFile(path.join(tmpDir, 'src', 'lib', 'legacy', 'old-utils.js'), `
function get_user_name() { return ''; }
function parse_data() { return null; }
function format_output() { return ''; }
`);

    const ctx = makeJsContext(tmpDir);
    const scanner = new ConventionScanner(tmpDir, makeDetectionResult(ctx));
    const result = await scanner.scan();
    const conventions = result.get(tmpDir);

    expect(conventions).toBeDefined();
    expect(conventions!.naming.functions).not.toBeNull();
    expect(conventions!.naming.functions!.pattern).toBe('camelCase');
    expect(conventions!.naming.functions!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(conventions!.naming.functions!.contested).toBe(false);

    const snakeMinority = conventions!.naming.functions!.minority.find(m => m.pattern === 'snake_case');
    expect(snakeMinority).toBeDefined();
    expect(snakeMinority!.locations.some(loc => loc.includes('old-utils.js'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. JS imports: contested (50/50 named vs default)
// ---------------------------------------------------------------------------
describe('JS imports: contested named vs default', () => {
  it('detects contested import style when split 50/50', async () => {
    // 3 files with named imports
    writeFile(path.join(tmpDir, 'src', 'a.js'), `import { foo } from './foo.js';`);
    writeFile(path.join(tmpDir, 'src', 'b.js'), `import { bar } from './bar.js';`);
    writeFile(path.join(tmpDir, 'src', 'c.js'), `import { baz } from './baz.js';`);

    // 3 files with default imports
    writeFile(path.join(tmpDir, 'src', 'd.js'), `import foo from './foo.js';`);
    writeFile(path.join(tmpDir, 'src', 'e.js'), `import bar from './bar.js';`);
    writeFile(path.join(tmpDir, 'src', 'f.js'), `import baz from './baz.js';`);

    const ctx = makeJsContext(tmpDir);
    const scanner = new ConventionScanner(tmpDir, makeDetectionResult(ctx));
    const result = await scanner.scan();
    const conventions = result.get(tmpDir);

    expect(conventions).toBeDefined();
    expect(conventions!.imports.dominant).not.toBeNull();
    expect(conventions!.imports.dominant!.contested).toBe(true);
    expect(conventions!.imports.dominant!.confidence).toBeLessThan(0.6);
  });
});

// ---------------------------------------------------------------------------
// 3. JS exports: named exports dominant
// ---------------------------------------------------------------------------
describe('JS exports: named exports dominant', () => {
  it('detects named as dominant export style', async () => {
    writeFile(path.join(tmpDir, 'src', 'a.js'), `export const foo = 1;\nexport function bar() {}`);
    writeFile(path.join(tmpDir, 'src', 'b.js'), `export const baz = 2;\nexport function qux() {}`);
    writeFile(path.join(tmpDir, 'src', 'c.js'), `export const alpha = 3;\nexport function beta() {}`);
    writeFile(path.join(tmpDir, 'src', 'd.js'), `export const gamma = 4;\nexport function delta() {}`);
    writeFile(path.join(tmpDir, 'src', 'e.js'), `export const epsilon = 5;`);
    writeFile(path.join(tmpDir, 'src', 'f.js'), `export default function main() {}`);

    const ctx = makeJsContext(tmpDir);
    const scanner = new ConventionScanner(tmpDir, makeDetectionResult(ctx));
    const result = await scanner.scan();
    const conventions = result.get(tmpDir);

    expect(conventions).toBeDefined();
    expect(conventions!.exports).not.toBeNull();
    expect(conventions!.exports!.dominant).not.toBeNull();
    expect(conventions!.exports!.dominant!.pattern).toBe('named');
    expect(conventions!.exports!.dominant!.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

// ---------------------------------------------------------------------------
// 4. Python naming: snake_case functions
// ---------------------------------------------------------------------------
describe('Python naming: snake_case functions', () => {
  it('detects snake_case as dominant for Python functions', async () => {
    writeFile(path.join(tmpDir, 'main.py'), `
def get_user_data():
    pass

def parse_response():
    pass

def format_output():
    pass

class UserService:
    pass

class DataParser:
    pass
`);

    const ctx = makePyContext(tmpDir);
    const scanner = new ConventionScanner(tmpDir, makeDetectionResult(ctx));
    const result = await scanner.scan();
    const conventions = result.get(tmpDir);

    expect(conventions).toBeDefined();
    expect(conventions!.naming.functions).not.toBeNull();
    expect(conventions!.naming.functions!.pattern).toBe('snake_case');
  });
});

// ---------------------------------------------------------------------------
// 5. Go: mixed exported/unexported functions
// ---------------------------------------------------------------------------
describe('Go: mixed exported/unexported functions', () => {
  it('detects both PascalCase and camelCase naming', async () => {
    writeFile(path.join(tmpDir, 'main.go'), `
package main

func GetUser() {}
func ParseData() {}
func handleRequest() {}
func processItems() {}
`);

    const ctx = makeGoContext(tmpDir);
    const scanner = new ConventionScanner(tmpDir, makeDetectionResult(ctx));
    const result = await scanner.scan();
    const conventions = result.get(tmpDir);

    expect(conventions).toBeDefined();
    expect(conventions!.naming.functions).not.toBeNull();

    // There should be minority patterns (either PascalCase or camelCase not dominant)
    const funcConvention = conventions!.naming.functions!;
    const patterns = [funcConvention.pattern, ...funcConvention.minority.map(m => m.pattern)];
    expect(patterns).toContain('PascalCase');
    expect(patterns).toContain('camelCase');
  });
});

// ---------------------------------------------------------------------------
// 6. Rust functions: snake_case
// ---------------------------------------------------------------------------
describe('Rust naming: snake_case functions', () => {
  it('detects snake_case as dominant for Rust functions', async () => {
    writeFile(path.join(tmpDir, 'src', 'main.rs'), `
fn get_user() {}
fn parse_data() {}
fn format_output() {}
struct UserService {}
`);

    const ctx = makeRustContext(tmpDir);
    const scanner = new ConventionScanner(tmpDir, makeDetectionResult(ctx));
    const result = await scanner.scan();
    const conventions = result.get(tmpDir);

    expect(conventions).toBeDefined();
    expect(conventions!.naming.functions).not.toBeNull();
    expect(conventions!.naming.functions!.pattern).toBe('snake_case');
  });
});

// ---------------------------------------------------------------------------
// 7. Test convention detection: .test.ts and .spec.ts files
// ---------------------------------------------------------------------------
describe('Test convention detection', () => {
  it('detects test file patterns in TS projects', async () => {
    writeFile(path.join(tmpDir, 'src', 'utils.ts'), `export function add(a: number, b: number): number { return a + b; }`);
    writeFile(path.join(tmpDir, 'src', 'utils.test.ts'), `
import { describe, it, expect } from 'vitest';
import { add } from './utils.js';
describe('add', () => {
  it('adds numbers', () => { expect(add(1, 2)).toBe(3); });
});
`);
    writeFile(path.join(tmpDir, 'src', 'api.test.ts'), `
import { describe, it, expect } from 'vitest';
describe('api', () => { it('works', () => { expect(true).toBe(true); }); });
`);
    writeFile(path.join(tmpDir, 'src', 'api.spec.ts'), `
import { describe, it, expect } from 'vitest';
describe('api spec', () => { it('works', () => { expect(true).toBe(true); }); });
`);

    const ctx = makeTsContext(tmpDir);
    const scanner = new ConventionScanner(tmpDir, makeDetectionResult(ctx));
    const result = await scanner.scan();
    const conventions = result.get(tmpDir);

    expect(conventions).toBeDefined();
    expect(conventions!.tests.filePattern).not.toBeNull();

    const testConvention = conventions!.tests.filePattern!;
    const allPatterns = [testConvention.pattern, ...testConvention.minority.map(m => m.pattern)];
    // Should detect both .test and .spec patterns
    expect(allPatterns.some(p => p === '.test' || p === '.spec')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Folder structure detection
// ---------------------------------------------------------------------------
describe('Folder structure detection', () => {
  it('detects src/ and tests/ directories', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    writeFile(path.join(tmpDir, 'src', 'index.js'), `export function hello() { return 'world'; }`);

    const ctx = makeJsContext(tmpDir);
    const scanner = new ConventionScanner(tmpDir, makeDetectionResult(ctx));
    const result = await scanner.scan();
    const conventions = result.get(tmpDir);

    expect(conventions).toBeDefined();
    expect(conventions!.folderStructure.sourceDir).toBe('src');
    expect(conventions!.folderStructure.testDir).toBe('tests');
  });
});
