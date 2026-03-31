import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseContextFile } from '@contextforge/generator';
import { DecisionStore } from '../decision-store.js';
import type { ContextCache } from '../context-cache.js';

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

export function handleGetContext(featureArea: string, cache: ContextCache): string {
  const ctx = cache.get();
  const projectRoot = ctx?.projectRoot ?? process.cwd();
  const contextPath = path.join(projectRoot, '.context.md');

  const keywords = extractKeywords(featureArea);
  const results: string[] = [];

  // Search .context.md sections
  try {
    const raw = fs.readFileSync(contextPath, 'utf8');
    const parsed = parseContextFile(raw);

    for (const section of parsed.sections) {
      // Skip sections whose content doesn't match any keyword
      const contentLower = section.content.toLowerCase();
      const matches = keywords.some(k => contentLower.includes(k));
      if (matches) {
        results.push(`### [${section.name}]\n${section.content.trim()}`);
      }
    }
  } catch {
    // .context.md doesn't exist yet
  }

  // Search decisions
  const store = new DecisionStore(projectRoot);
  const matchingDecisions = store.query(keywords);
  if (matchingDecisions.length > 0) {
    results.push('### [decisions]');
    for (const d of matchingDecisions) {
      results.push(`**${d.topic}** (${d.timestamp})\nDecision: ${d.decision}\nRationale: ${d.rationale}`);
    }
  }

  if (results.length === 0) {
    return `No context found for feature area: "${featureArea}". Try running \`contextforge init\` to generate context.`;
  }

  return `## Relevant context for: "${featureArea}"\n\n${results.join('\n\n')}`;
}
