import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseContextFile } from '@contextforge/generator';
import { DecisionStore } from '../decision-store.js';
import type { ContextCache } from '../context-cache.js';
import type { ConventionOccurrence } from '@contextforge/scanner';

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3); // slightly longer threshold for prompt keywords
}

function formatOccurrenceInline(label: string, occ: ConventionOccurrence | null): string | null {
  if (!occ) return null;
  const pct = Math.round(occ.confidence * 100);
  let out = `- ${label}: **${occ.pattern}** (${pct}%)`;
  if (occ.contested && occ.minority.length > 0) {
    const minorities = occ.minority
      .map(m => `${m.pattern} in ${m.locations.slice(0, 2).join(', ')}`)
      .join('; ');
    out += `\n  ⚠ **Contested** — also found: ${minorities}`;
  }
  return out;
}

function getSectionContent(contextMdPath: string, sectionName: string): string | null {
  try {
    const raw = fs.readFileSync(contextMdPath, 'utf8');
    const parsed = parseContextFile(raw);
    const section = parsed.sections.find(s => s.name === sectionName);
    return section?.content.trim() ?? null;
  } catch {
    return null;
  }
}

export function handleEnrichPrompt(rawPrompt: string, cache: ContextCache): string {
  const ctx = cache.get();
  const projectRoot = ctx?.projectRoot ?? process.cwd();
  const contextPath = path.join(projectRoot, '.context.md');
  const keywords = extractKeywords(rawPrompt);

  const parts: string[] = [];

  // 1. Restated intent
  parts.push(`## Enriched Prompt\n\n**Intent:** ${rawPrompt}`);

  // 2. Stack context
  const stackContent = getSectionContent(contextPath, 'stack');
  if (stackContent) {
    parts.push(`### Stack Context\n\n${stackContent}`);
  }

  // 3. Applicable conventions with confidence scores
  if (ctx && ctx.conventions.size > 0) {
    const convLines: string[] = ['### Applicable Conventions'];
    for (const langCtx of ctx.detection.languages) {
      const conventions = ctx.conventions.get(langCtx.root);
      if (!conventions) continue;

      convLines.push(`\n**${langCtx.language}:**`);
      const { naming, imports, exports: expts, tests } = conventions;

      const entries = [
        formatOccurrenceInline('Function naming', naming.functions),
        formatOccurrenceInline('Class naming', naming.classes),
        formatOccurrenceInline('Variable naming', naming.variables),
        expts ? formatOccurrenceInline('Export style', expts.dominant) : null,
        formatOccurrenceInline('Import style', imports.dominant),
        tests.framework ? `- Test framework: **${tests.framework}**` : null,
      ].filter((s): s is string => s !== null);

      convLines.push(...entries);
    }
    parts.push(convLines.join('\n'));
  } else {
    const convContent = getSectionContent(contextPath, 'conventions');
    if (convContent) {
      parts.push(`### Applicable Conventions\n\n${convContent}`);
    }
  }

  // 4. Prior decisions matching prompt keywords
  const store = new DecisionStore(projectRoot);
  const matchingDecisions = store.query(keywords);
  if (matchingDecisions.length > 0) {
    const decLines = ['### Prior Decisions'];
    for (const d of matchingDecisions) {
      decLines.push(`\n**${d.topic}:** ${d.decision}`);
      if (d.rationale) decLines.push(`_Rationale: ${d.rationale}_`);
    }
    parts.push(decLines.join('\n'));
  }

  // 5. Anti-patterns
  const antiContent = getSectionContent(contextPath, 'anti-patterns');
  if (antiContent && !antiContent.includes('No anti-patterns recorded')) {
    parts.push(`### Anti-Patterns to Avoid\n\n${antiContent}`);
  }

  // 6. Original prompt at the end
  parts.push(`---\n_Original prompt: ${rawPrompt}_`);

  return parts.join('\n\n');
}
