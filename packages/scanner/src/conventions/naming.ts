import type { ConventionOccurrence, MinorityEntry } from './types.js';

export type NamingPattern = 'camelCase' | 'snake_case' | 'PascalCase' | 'UPPER_SNAKE' | 'kebab-case' | 'other';

export function detectNamingPattern(name: string): NamingPattern {
  if (!name || name.length < 2) return 'other';
  if (/^[A-Z][A-Z0-9_]*(_[A-Z0-9]+)+$/.test(name)) return 'UPPER_SNAKE';
  if (/^[A-Z][A-Za-z0-9]*$/.test(name) && /[a-z]/.test(name)) return 'PascalCase';
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) return 'snake_case';
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) return 'kebab-case';
  return 'other';
}

// Accumulator: tracks pattern -> {count, Set<filePath>}
export class PatternAccumulator {
  private data = new Map<string, { count: number; locations: Set<string> }>();

  add(pattern: string, filePath: string): void {
    const existing = this.data.get(pattern);
    if (existing) {
      existing.count++;
      existing.locations.add(filePath);
    } else {
      this.data.set(pattern, { count: 1, locations: new Set([filePath]) });
    }
  }

  toOccurrence(): ConventionOccurrence | null {
    if (this.data.size === 0) return null;

    let dominantPattern = '';
    let dominantCount = 0;
    let total = 0;

    for (const [pattern, entry] of this.data) {
      total += entry.count;
      if (entry.count > dominantCount) {
        dominantCount = entry.count;
        dominantPattern = pattern;
      }
    }

    if (total === 0) return null;

    const confidence = dominantCount / total;
    const contested = confidence < 0.6;

    const minority: MinorityEntry[] = [];
    for (const [pattern, entry] of this.data) {
      if (pattern !== dominantPattern) {
        minority.push({
          pattern,
          count: entry.count,
          locations: Array.from(entry.locations),
        });
      }
    }

    return {
      pattern: dominantPattern,
      count: dominantCount,
      total,
      confidence,
      contested,
      minority,
    };
  }
}
