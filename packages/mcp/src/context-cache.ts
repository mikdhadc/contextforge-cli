import type { DetectionResult, ConventionResult } from '@contextforge/scanner';

export interface CachedContext {
  projectRoot: string;
  detection: DetectionResult;
  conventions: ConventionResult;
  contextMdPath: string;      // path to .context.md
  lastRunAt: Date;
}

export class ContextCache {
  private cache: CachedContext | null = null;

  set(ctx: CachedContext): void { this.cache = ctx; }
  get(): CachedContext | null { return this.cache; }
  clear(): void { this.cache = null; }
}
