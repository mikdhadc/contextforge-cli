export { ProjectDetector } from './detector.js';
export { ConventionScanner } from './conventions/scanner.js';
export type { DetectionResult, LanguageContext, Language, Framework, PackageManager } from './types.js';
export type {
  ConventionResult,
  ConventionSet,
  ConventionOccurrence,
  NamingConventions,
  ImportStyle,
  ExportStyle,
  TestConventions,
  FolderStructure,
  MinorityEntry,
} from './conventions/types.js';
export const VERSION = '0.1.0';
