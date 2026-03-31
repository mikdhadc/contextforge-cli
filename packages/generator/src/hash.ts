import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function sha256Short(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').substring(0, 8);
}

const SIGNATURE_FILES = [
  'package.json', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json',
  'go.mod', 'go.sum',
  'Cargo.toml', 'Cargo.lock',
  'requirements.txt', 'pyproject.toml', 'poetry.lock', 'uv.lock',
  'composer.json', 'composer.lock',
  'Gemfile', 'Gemfile.lock',
];

export function computeSignatureHash(projectRoot: string): string {
  const parts: string[] = [];
  for (const file of SIGNATURE_FILES) {
    const fullPath = path.join(projectRoot, file);
    try {
      parts.push(fs.readFileSync(fullPath, 'utf8'));
    } catch {
      // file doesn't exist, skip
    }
  }
  return sha256Short(parts.join('\n'));
}
