// Context file generator — writes .context.md and IDE-native files

export { ContextFileGenerator, wrapSection } from './generator.js';
export { IDEFileWriter } from './ide-writer.js';
export { patchContextFile, hasManualContent } from './patcher.js';
export { parseContextFile } from './parser.js';
export { renderAllSections } from './renderer.js';
export { sha256Short, computeSignatureHash } from './hash.js';
export type { GeneratorInput, SectionName, IdeTarget, ParsedSection, ParsedManualBlock, ParsedContextFile } from './types.js';
export const VERSION = '0.1.0';
