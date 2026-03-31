import type { ContextCache } from '../context-cache.js';
import type { ConventionOccurrence } from '@contextforge/scanner';

function formatOccurrence(label: string, occ: ConventionOccurrence | null): string | null {
  if (!occ) return null;
  const pct = Math.round(occ.confidence * 100);
  let out = `${label}: ${occ.pattern} (${pct}% confidence)`;
  if (occ.contested && occ.minority.length > 0) {
    const minorities = occ.minority
      .map(m => `${m.pattern} found in ${m.locations.slice(0, 3).join(', ')}`)
      .join('; ');
    out += `\n  ⚠ Contested: ${minorities}`;
  }
  return out;
}

export function handleGetConventions(cache: ContextCache): string {
  const ctx = cache.get();
  if (!ctx) {
    return 'No scan results available. Run `contextforge init` first or ensure PROJECT_ROOT is set correctly.';
  }

  const lines: string[] = [];

  for (const langCtx of ctx.detection.languages) {
    const conventions = ctx.conventions.get(langCtx.root);
    lines.push(`## ${langCtx.language} (${langCtx.root})`);

    if (!conventions) {
      lines.push('  (no conventions detected)');
      lines.push('');
      continue;
    }

    const { naming, imports, exports: expts, tests } = conventions;

    const entries = [
      formatOccurrence('Function naming', naming.functions),
      formatOccurrence('Class naming', naming.classes),
      formatOccurrence('Variable naming', naming.variables),
      formatOccurrence('Constant naming', naming.constants),
      formatOccurrence('Import style', imports.dominant),
      expts ? formatOccurrence('Export style', expts.dominant) : null,
      formatOccurrence('Test file pattern', tests.filePattern),
      tests.framework ? `Test framework: ${tests.framework}` : null,
    ].filter((s): s is string => s !== null);

    lines.push(...entries.map(e => `  ${e}`));
    lines.push('');
  }

  return lines.join('\n').trimEnd() || 'No conventions detected.';
}
