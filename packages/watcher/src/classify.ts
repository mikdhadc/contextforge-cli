import path from 'node:path';
import type { ChangeCategory } from './types.js';

/** Dependency manifest filenames (exact match, case-sensitive) */
const DEPENDENCY_MANIFESTS = new Set([
  'package.json',
  'go.mod',
  'Cargo.toml',
  'composer.json',
  'Gemfile',
  'pyproject.toml',
]);

/** Config filenames / patterns */
const CONFIG_EXACT = new Set(['tsconfig.json']);

function isConfigFile(filename: string): boolean {
  if (CONFIG_EXACT.has(filename)) return true;
  // .eslintrc, .eslintrc.js, .eslintrc.json, .eslintrc.yml, etc.
  if (filename.startsWith('.eslintrc')) return true;
  // jest.config.js, jest.config.ts, jest.config.mjs, etc.
  if (filename.startsWith('jest.config')) return true;
  // vitest.config.*, prettier.config.*, babel.config.*
  if (
    filename.startsWith('vitest.config') ||
    filename.startsWith('prettier.config') ||
    filename.startsWith('babel.config')
  ) return true;
  return false;
}

function isSchemaFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.sql' || ext === '.prisma') return true;
  if (filename.toLowerCase().includes('schema')) return true;
  return false;
}

/**
 * Classify a file path change into a ChangeCategory.
 * Returns null if the change is not considered meaningful.
 */
export function classifyPath(
  filePath: string,
  fsEvent: 'add' | 'change' | 'unlink' | 'addDir',
): ChangeCategory | null {
  const filename = path.basename(filePath);

  // New directory under src/ or app/
  if (fsEvent === 'addDir') {
    const normalized = filePath.replace(/\\/g, '/');
    if (/\/(src|app)\//.test(normalized) || normalized.endsWith('/src') || normalized.endsWith('/app')) {
      return 'new-directory';
    }
    return null;
  }

  if (DEPENDENCY_MANIFESTS.has(filename)) return 'dependency-manifest';
  if (isConfigFile(filename)) return 'config';
  if (isSchemaFile(filename)) return 'schema';

  return null;
}
