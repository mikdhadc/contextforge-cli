import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

// ── WASM path resolution ────────────────────────────────────────────────────

/**
 * Resolve the web-tree-sitter runtime WASM.
 * `web-tree-sitter` exports `./web-tree-sitter.wasm` explicitly, so
 * createRequire can resolve it without touching package.json.
 */
function resolveWtsWasm(): string {
  return require.resolve('web-tree-sitter/web-tree-sitter.wasm');
}

/**
 * Resolve a grammar .wasm file by walking up from the package's main entry.
 * Grammar packages don't restrict subpath exports, but package.json access
 * is unreliable in Node 22 ESM. Instead we resolve the CJS main and walk up.
 */
function resolveGrammarWasm(packageName: string, wasmFile: string): string {
  const mainPath = require.resolve(packageName);
  let dir = path.dirname(mainPath);
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, wasmFile);
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error(`Cannot find ${wasmFile} near ${mainPath}`);
}

// ── Singleton init ──────────────────────────────────────────────────────────

let initialized = false;
// web-tree-sitter uses named exports (no default export)
let ParserClass: typeof import('web-tree-sitter').Parser | null = null;
let LanguageClass: typeof import('web-tree-sitter').Language | null = null;

async function getClasses(): Promise<{
  Parser: typeof import('web-tree-sitter').Parser;
  Language: typeof import('web-tree-sitter').Language;
}> {
  if (!ParserClass || !LanguageClass) {
    const wts = await import('web-tree-sitter');
    ParserClass = wts.Parser;      // named export, NOT wts.default
    LanguageClass = wts.Language;
  }
  return { Parser: ParserClass!, Language: LanguageClass! };
}

async function initOnce(): Promise<void> {
  if (initialized) return;
  const { Parser } = await getClasses();
  const wasmPath = resolveWtsWasm();
  await Parser.init({ locateFile: () => wasmPath });
  initialized = true;
}

// ── Language cache ──────────────────────────────────────────────────────────

const languageCache = new Map<string, import('web-tree-sitter').Language>();

export async function getLanguage(
  grammarPackage: string,
  wasmFile: string,
): Promise<import('web-tree-sitter').Language | null> {
  if (languageCache.has(grammarPackage)) return languageCache.get(grammarPackage)!;
  try {
    await initOnce();
    const { Language } = await getClasses();
    const wasmPath = resolveGrammarWasm(grammarPackage, wasmFile);
    const lang = await Language.load(wasmPath);
    languageCache.set(grammarPackage, lang);
    return lang;
  } catch (err) {
    // Grammar unavailable (missing binary or incompatible ABI) — callers skip parsing
    return null;
  }
}

export async function createParser(
  grammarPackage: string,
  wasmFile: string,
): Promise<import('web-tree-sitter').Parser | null> {
  const lang = await getLanguage(grammarPackage, wasmFile);
  if (!lang) return null;
  const { Parser } = await getClasses();
  const parser = new Parser();
  parser.setLanguage(lang);
  return parser;
}
