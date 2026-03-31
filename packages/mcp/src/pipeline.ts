import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectDetector } from '@contextforge/scanner';
import { ConventionScanner } from '@contextforge/scanner';
import { ContextFileGenerator, IDEFileWriter } from '@contextforge/generator';
import { computeSignatureHash } from '@contextforge/generator';
import type { ContextCache } from './context-cache.js';

export const PROJECT_ROOT = process.env.PROJECT_ROOT ?? process.cwd();

/**
 * Check if .context.md exists and its signature hash matches the current codebase.
 * Returns true if the file is fresh (no regeneration needed).
 */
export function isContextFresh(projectRoot: string): boolean {
  const contextPath = path.join(projectRoot, '.context.md');
  try {
    const content = fs.readFileSync(contextPath, 'utf8');
    const match = content.match(/Signature hash: ([a-f0-9]+)/);
    if (!match) return false;
    const stored = match[1];
    const current = computeSignatureHash(projectRoot);
    return stored === current;
  } catch {
    return false; // file doesn't exist
  }
}

/**
 * Run the full detection + scanning + generation pipeline.
 * Updates the cache with fresh results.
 */
export async function runFullPipeline(projectRoot: string, cache: ContextCache): Promise<void> {
  const detector = new ProjectDetector(projectRoot);
  const detection = await detector.detect();

  const scanner = new ConventionScanner(projectRoot, detection);
  const conventions = await scanner.scan();

  const generator = new ContextFileGenerator({ projectRoot, detection, conventions });
  await generator.generate();

  // Write IDE-native file if an IDE is detected
  const ideWriter = new IDEFileWriter(projectRoot);
  const ide = ideWriter.detectIde();
  if (ide) {
    const contextPath = path.join(projectRoot, '.context.md');
    const content = fs.readFileSync(contextPath, 'utf8');
    ideWriter.write(ide, ideWriter.formatForIde(ide, content));
  }

  cache.set({
    projectRoot,
    detection,
    conventions,
    contextMdPath: path.join(projectRoot, '.context.md'),
    lastRunAt: new Date(),
  });
}

/**
 * Run the pipeline only for a specific file path that changed.
 * Re-scans only the affected LanguageContext (the one whose root contains the changed path).
 * Then patches only the affected sections in .context.md.
 */
export async function runIncrementalPipeline(
  projectRoot: string,
  changedPath: string,
  cache: ContextCache,
): Promise<void> {
  const cached = cache.get();
  if (!cached) {
    // No cache — fall back to full pipeline
    await runFullPipeline(projectRoot, cache);
    return;
  }

  // Find the affected language context
  const { detection } = cached;
  const affectedCtx = detection.languages.find(ctx =>
    changedPath.startsWith(ctx.root)
  ) ?? detection.languages[0]; // fall back to first if no match

  if (!affectedCtx) {
    await runFullPipeline(projectRoot, cache);
    return;
  }

  // Re-scan only the affected context
  const scanner = new ConventionScanner(projectRoot, {
    ...detection,
    languages: [affectedCtx],
  });
  const freshConventions = await scanner.scan();

  // Merge with existing conventions
  const mergedConventions = new Map(cached.conventions);
  for (const [key, value] of freshConventions) {
    mergedConventions.set(key, value);
  }

  // Re-generate with merged result (patcher will only touch changed sections)
  const generator = new ContextFileGenerator({
    projectRoot,
    detection,
    conventions: mergedConventions,
  });
  await generator.generate();

  cache.set({ ...cached, conventions: mergedConventions, lastRunAt: new Date() });
}
