import type { ParsedContextFile, SectionName } from './types.js';
import { parseContextFile } from './parser.js';

const EMPTY_MANUAL_BLOCK = `<!-- contextforge:manual:start -->\n<!-- Add your manual context overrides here. This block is never modified by contextforge. -->\n<!-- contextforge:manual:end -->\n`;

export function patchContextFile(
  existingContent: string,
  updatedSections: Map<SectionName, string>,  // section name → full delimited block
): string {
  if (!existingContent) {
    // New file: just concatenate all sections + manual block
    let result = '';
    for (const content of updatedSections.values()) result += content + '\n';
    result += EMPTY_MANUAL_BLOCK;
    return result;
  }

  const parsed = parseContextFile(existingContent);

  // Build a set of protected ranges (manual block regions)
  const protectedRanges = parsed.manualBlocks.map(mb => ({ start: mb.startIndex, end: mb.endIndex }));

  let result = existingContent;

  // Process replacements from end to start (to preserve indices)
  const existingSectionNames = new Set(parsed.sections.map(s => s.name));
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  for (const [name, newContent] of updatedSections) {
    const existing = parsed.sections.find(s => s.name === name);
    if (existing) {
      // Verify no overlap with protected regions
      const overlapsProtected = protectedRanges.some(
        pr => !(existing.endIndex <= pr.start || existing.startIndex >= pr.end)
      );
      if (!overlapsProtected) {
        replacements.push({ start: existing.startIndex, end: existing.endIndex, replacement: newContent });
      }
    }
  }

  // Sort replacements by start index descending (apply from end to start)
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  // Append new sections (those not already in the file)
  for (const [name, content] of updatedSections) {
    if (!existingSectionNames.has(name)) {
      // Insert before manual block if it exists, otherwise at end
      const manualBlock = parsed.manualBlocks[0];
      if (manualBlock) {
        // Re-parse to get current position after previous replacements
        const reparsed = parseContextFile(result);
        const mb = reparsed.manualBlocks[0];
        if (mb) {
          result = result.slice(0, mb.startIndex) + content + '\n' + result.slice(mb.startIndex);
        } else {
          result += '\n' + content;
        }
      } else {
        result += '\n' + content;
      }
    }
  }

  return result;
}

export function hasManualContent(existingContent: string): boolean {
  const parsed = parseContextFile(existingContent);
  if (parsed.manualBlocks.length === 0) return false;
  const block = parsed.manualBlocks[0];
  // Strip the usage comment and check if there's real content
  const withoutComment = block.content
    .replace(/<!-- Add your manual context overrides here\. This block is never modified by contextforge\. -->/g, '')
    .trim();
  return withoutComment.length > 0;
}
