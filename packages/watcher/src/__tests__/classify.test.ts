import { describe, it, expect } from 'vitest';
import { classifyPath } from '../classify.js';

describe('classifyPath: dependency manifests', () => {
  const manifests = ['package.json', 'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile', 'pyproject.toml'];
  for (const file of manifests) {
    it(`classifies ${file} as dependency-manifest`, () => {
      expect(classifyPath(`/project/${file}`, 'change')).toBe('dependency-manifest');
    });
  }
});

describe('classifyPath: config files', () => {
  it('classifies tsconfig.json as config', () => {
    expect(classifyPath('/project/tsconfig.json', 'change')).toBe('config');
  });

  it('classifies .eslintrc as config', () => {
    expect(classifyPath('/project/.eslintrc', 'change')).toBe('config');
  });

  it('classifies .eslintrc.json as config', () => {
    expect(classifyPath('/project/.eslintrc.json', 'change')).toBe('config');
  });

  it('classifies jest.config.ts as config', () => {
    expect(classifyPath('/project/jest.config.ts', 'change')).toBe('config');
  });

  it('classifies vitest.config.ts as config', () => {
    expect(classifyPath('/project/vitest.config.ts', 'change')).toBe('config');
  });
});

describe('classifyPath: schema files', () => {
  it('classifies .sql files as schema', () => {
    expect(classifyPath('/project/db/migrations/001.sql', 'add')).toBe('schema');
  });

  it('classifies .prisma files as schema', () => {
    expect(classifyPath('/project/prisma/schema.prisma', 'change')).toBe('schema');
  });

  it('classifies files with "schema" in the name as schema', () => {
    expect(classifyPath('/project/src/graphql/schema.graphql', 'change')).toBe('schema');
    expect(classifyPath('/project/src/db/userSchema.ts', 'change')).toBe('schema');
  });
});

describe('classifyPath: new directories', () => {
  it('classifies new dir under src/ as new-directory', () => {
    expect(classifyPath('/project/src/features', 'addDir')).toBe('new-directory');
    expect(classifyPath('/project/src/api/handlers', 'addDir')).toBe('new-directory');
  });

  it('classifies new dir under app/ as new-directory', () => {
    expect(classifyPath('/project/app/dashboard', 'addDir')).toBe('new-directory');
  });

  it('returns null for new dir outside src/ and app/', () => {
    expect(classifyPath('/project/docs/new-section', 'addDir')).toBeNull();
  });

  it('returns null for addDir on unrelated path', () => {
    expect(classifyPath('/project/logs', 'addDir')).toBeNull();
  });
});

describe('classifyPath: uninteresting files', () => {
  it('returns null for arbitrary source files', () => {
    expect(classifyPath('/project/src/utils.ts', 'change')).toBeNull();
    expect(classifyPath('/project/src/index.ts', 'add')).toBeNull();
    expect(classifyPath('/project/README.md', 'change')).toBeNull();
  });

  it('returns null for unlink of non-manifest files', () => {
    expect(classifyPath('/project/src/old-util.js', 'unlink')).toBeNull();
  });
});
