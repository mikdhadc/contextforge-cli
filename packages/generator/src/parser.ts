import type { ParsedContextFile, ParsedSection, ParsedManualBlock } from './types.js';

export function parseContextFile(raw: string): ParsedContextFile {
  const sections: ParsedSection[] = [];
  const manualBlocks: ParsedManualBlock[] = [];

  // Scan for manual blocks FIRST so we can exclude sections inside them
  const manualStartRe = /<!-- contextforge:manual:start -->/g;
  let match: RegExpExecArray | null;

  while ((match = manualStartRe.exec(raw)) !== null) {
    const startIndex = match.index;
    const endTag = '<!-- contextforge:manual:end -->';
    const endIndex = raw.indexOf(endTag, manualStartRe.lastIndex);
    if (endIndex === -1) continue;
    const fullEndIndex = endIndex + endTag.length;
    const content = raw.slice(manualStartRe.lastIndex, endIndex);
    manualBlocks.push({ content, startIndex, endIndex: fullEndIndex });
  }

  // Helper: check if a position falls inside any manual block
  function isInsideManualBlock(pos: number): boolean {
    return manualBlocks.some(mb => pos >= mb.startIndex && pos < mb.endIndex);
  }

  // Scan for section start tags, skipping any inside manual blocks
  const startRe = /<!-- contextforge:([a-z-]+):start hash="([^"]*)" -->/g;

  while ((match = startRe.exec(raw)) !== null) {
    const sectionName = match[1];
    const hash = match[2];
    const startIndex = match.index;

    // Skip sections that are inside a manual block
    if (isInsideManualBlock(startIndex)) continue;

    // Find the matching end tag
    const endTag = `<!-- contextforge:${sectionName}:end -->`;
    const endIndex = raw.indexOf(endTag, startRe.lastIndex);
    if (endIndex === -1) continue;

    const fullEndIndex = endIndex + endTag.length;
    const content = raw.slice(startRe.lastIndex, endIndex);

    sections.push({ name: sectionName, hash, content, startIndex, endIndex: fullEndIndex });
  }

  const firstItemIndex = Math.min(
    sections[0]?.startIndex ?? Infinity,
    manualBlocks[0]?.startIndex ?? Infinity,
  );
  const header = firstItemIndex === Infinity ? raw : raw.slice(0, firstItemIndex);

  return { header, sections, manualBlocks, raw };
}
