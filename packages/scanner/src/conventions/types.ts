export interface ConventionOccurrence {
  pattern: string;
  count: number;
  total: number;
  confidence: number;       // count / total
  contested: boolean;        // true if confidence < 0.6
  minority: MinorityEntry[]; // other patterns found
}

export interface MinorityEntry {
  pattern: string;
  count: number;
  locations: string[];       // relative file paths where this minority pattern appears
}

export interface NamingConventions {
  functions: ConventionOccurrence | null;
  classes: ConventionOccurrence | null;
  variables: ConventionOccurrence | null;
  constants: ConventionOccurrence | null;
}

export interface ImportStyle {
  dominant: ConventionOccurrence | null;  // 'named' | 'default' | 'namespace' | 'require' | 'dynamic'
}

export interface ExportStyle {
  dominant: ConventionOccurrence | null;  // 'named' | 'default' | 'barrel' | 'reexport'
}

export interface TestConventions {
  filePattern: ConventionOccurrence | null; // '.test.ts' | '.spec.ts' | '_test.go' | 'test_*.py' etc.
  framework: string | null;                 // 'jest' | 'vitest' | 'pytest' | 'go-testing' etc.
}

export interface FolderStructure {
  sourceDir: string | null;   // 'src' | 'lib' | 'app' | null
  testDir: string | null;     // 'tests' | 'test' | '__tests__' | 'spec' | null
  hasConfigDir: boolean;
}

export interface ConventionSet {
  naming: NamingConventions;
  imports: ImportStyle;
  exports: ExportStyle | null; // null for non-JS/TS languages
  tests: TestConventions;
  folderStructure: FolderStructure;
}

// Maps each LanguageContext (by its root path) to its ConventionSet
export type ConventionResult = Map<string, ConventionSet>;
