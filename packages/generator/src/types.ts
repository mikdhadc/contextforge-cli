import type { DetectionResult, ConventionResult, LanguageContext } from '@contextforge/scanner';

export interface GeneratorInput {
  projectRoot: string;
  detection: DetectionResult;
  conventions: ConventionResult;
}

export type SectionName = 'stack' | 'structure' | 'conventions' | 'dependencies' | 'anti-patterns' | 'decisions';
export type IdeTarget = 'claude-code' | 'cursor' | 'windsurf' | 'vscode' | 'antigravity';

export interface ParsedSection {
  name: string;
  hash: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedManualBlock {
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedContextFile {
  header: string;           // everything before first section
  sections: ParsedSection[];
  manualBlocks: ParsedManualBlock[];
  raw: string;
}
