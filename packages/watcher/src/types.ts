export type ChangeCategory =
  | 'dependency-manifest'   // package.json, go.mod, Cargo.toml, composer.json, Gemfile, pyproject.toml
  | 'new-directory'         // new dir under src/ or app/
  | 'schema'                // *.sql, *.prisma, *schema* files
  | 'config';               // tsconfig.json, .eslintrc*, jest.config*, etc.

export interface ChangeEvent {
  category: ChangeCategory;
  /** Absolute path of the file or directory that changed */
  path: string;
  /** 'add' | 'change' | 'unlink' | 'addDir' */
  fsEvent: 'add' | 'change' | 'unlink' | 'addDir';
  timestamp: Date;
}
