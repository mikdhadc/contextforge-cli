import * as path from 'node:path';
import type { DetectionResult, LanguageContext } from '../types.js';
import type { ConventionResult, ConventionSet } from './types.js';
import { detectJsTsConventions } from './detectors/js-ts.js';
import { detectPythonConventions } from './detectors/python.js';
import { detectGoConventions } from './detectors/go.js';
import { detectRustConventions } from './detectors/rust.js';
import { detectPhpConventions } from './detectors/php.js';
import { detectRubyConventions } from './detectors/ruby.js';
import { walkFiles } from './walk.js';

const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  python: ['.py'],
  go: ['.go'],
  rust: ['.rs'],
  php: ['.php'],
  ruby: ['.rb'],
};

export class ConventionScanner {
  constructor(
    private readonly projectRoot: string,
    private readonly detection: DetectionResult,
  ) {}

  async scan(): Promise<ConventionResult> {
    const result: ConventionResult = new Map();

    for (const ctx of this.detection.languages) {
      const conventions = await this.scanContext(ctx);
      result.set(ctx.root, conventions);
    }

    return result;
  }

  private async scanContext(ctx: LanguageContext): Promise<ConventionSet> {
    const files = this.collectFiles(ctx);

    switch (ctx.language) {
      case 'javascript':
      case 'typescript':
        return detectJsTsConventions(ctx, files);
      case 'python':
        return detectPythonConventions(ctx, files);
      case 'go':
        return detectGoConventions(ctx, files);
      case 'rust':
        return detectRustConventions(ctx, files);
      case 'php':
        return detectPhpConventions(ctx, files);
      case 'ruby':
        return detectRubyConventions(ctx, files);
    }
  }

  private collectFiles(ctx: LanguageContext): string[] {
    const extensions = this.getExtensions(ctx.language);
    return walkFiles(ctx.root, extensions);
  }

  private getExtensions(language: string): string[] {
    // JS and TS both use JS detector but walk both extensions
    if (language === 'javascript' || language === 'typescript') {
      return [
        ...LANGUAGE_EXTENSIONS['javascript'],
        ...LANGUAGE_EXTENSIONS['typescript'],
      ];
    }
    return LANGUAGE_EXTENSIONS[language] ?? [];
  }
}
