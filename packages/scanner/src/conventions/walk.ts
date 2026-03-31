import * as fs from 'node:fs';
import * as path from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', 'vendor', '__pycache__', 'target',
  '.next', 'build', 'coverage',
]);

export function walkFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(path.join(current, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          results.push(path.join(current, entry.name));
        }
      }
    }
  }

  walk(dir);
  return results;
}

export function detectFolderStructure(root: string): {
  sourceDir: string | null;
  testDir: string | null;
  hasConfigDir: boolean;
} {
  const sourceDirs = ['src', 'lib', 'app'];
  const testDirs = ['tests', 'test', '__tests__', 'spec'];
  const configDirs = ['config', '.config', 'configs'];

  let sourceDir: string | null = null;
  let testDir: string | null = null;
  let hasConfigDir = false;

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (sourceDirs.includes(entry.name)) sourceDir = entry.name;
      if (testDirs.includes(entry.name)) testDir = entry.name;
      if (configDirs.includes(entry.name)) hasConfigDir = true;
    }
  } catch {
    // ignore
  }

  return { sourceDir, testDir, hasConfigDir };
}
