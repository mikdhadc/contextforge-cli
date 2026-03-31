import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectDetector } from '../detector.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Single JS project
// ---------------------------------------------------------------------------
describe('single JS project', () => {
  it('detects javascript, react framework, pnpm package manager, isMonorepo false', async () => {
    writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'my-app',
      dependencies: { react: '^18.0.0' },
    }));
    writeFile(path.join(tmpDir, 'pnpm-lock.yaml'), '');

    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.projectRoot).toBe(tmpDir);
    expect(result.languages).toHaveLength(1);
    const ctx = result.languages[0];
    expect(ctx.language).toBe('javascript');
    expect(ctx.frameworks).toContain('react');
    expect(ctx.packageManager).toBe('pnpm');
    expect(ctx.isMonorepo).toBe(false);
    expect(ctx.signatureFiles).toContain('package.json');
    expect(result.isPolyglot).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Single TS project
// ---------------------------------------------------------------------------
describe('single TS project', () => {
  it('detects typescript and next.js framework', async () => {
    writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'my-next-app',
      dependencies: { next: '^14.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    }));

    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.languages).toHaveLength(1);
    const ctx = result.languages[0];
    expect(ctx.language).toBe('typescript');
    expect(ctx.frameworks).toContain('next.js');
    expect(ctx.packageManager).toBe('npm');
  });
});

// ---------------------------------------------------------------------------
// 3. Monorepo (workspaces field)
// ---------------------------------------------------------------------------
describe('JS monorepo', () => {
  it('detects isMonorepo true when package.json has workspaces', async () => {
    writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'my-monorepo',
      workspaces: ['packages/*'],
    }));

    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.languages).toHaveLength(1);
    expect(result.languages[0].isMonorepo).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Python project
// ---------------------------------------------------------------------------
describe('Python project', () => {
  it('detects python and fastapi framework', async () => {
    writeFile(path.join(tmpDir, 'pyproject.toml'), `
[tool.poetry.dependencies]
fastapi = "^0.100.0"
`);

    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.languages).toHaveLength(1);
    const ctx = result.languages[0];
    expect(ctx.language).toBe('python');
    expect(ctx.frameworks).toContain('fastapi');
    expect(ctx.packageManager).toBe('pip');
    expect(result.isPolyglot).toBe(false);
  });

  it('detects poetry package manager when poetry.lock exists', async () => {
    writeFile(path.join(tmpDir, 'pyproject.toml'), '[tool.poetry]\nname = "app"\n');
    writeFile(path.join(tmpDir, 'poetry.lock'), '');

    const result = await new ProjectDetector(tmpDir).detect();
    expect(result.languages[0].packageManager).toBe('poetry');
  });

  it('detects uv package manager when uv.lock exists', async () => {
    writeFile(path.join(tmpDir, 'pyproject.toml'), '[project]\nname = "app"\n');
    writeFile(path.join(tmpDir, 'uv.lock'), '');

    const result = await new ProjectDetector(tmpDir).detect();
    expect(result.languages[0].packageManager).toBe('uv');
  });

  it('detects pipenv package manager when Pipfile exists', async () => {
    writeFile(path.join(tmpDir, 'requirements.txt'), 'flask\n');
    writeFile(path.join(tmpDir, 'Pipfile'), '');

    const result = await new ProjectDetector(tmpDir).detect();
    expect(result.languages[0].packageManager).toBe('pipenv');
  });
});

// ---------------------------------------------------------------------------
// 5. Go project
// ---------------------------------------------------------------------------
describe('Go project', () => {
  it('detects go and gin framework', async () => {
    writeFile(path.join(tmpDir, 'go.mod'), `module example.com/myapp

go 1.21

require (
  github.com/gin-gonic/gin v1.9.0
)
`);

    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.languages).toHaveLength(1);
    const ctx = result.languages[0];
    expect(ctx.language).toBe('go');
    expect(ctx.frameworks).toContain('gin');
    expect(ctx.packageManager).toBe('go mod');
    expect(result.isPolyglot).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Rust project
// ---------------------------------------------------------------------------
describe('Rust project', () => {
  it('detects rust and axum framework', async () => {
    writeFile(path.join(tmpDir, 'Cargo.toml'), `[package]
name = "myapp"
version = "0.1.0"

[dependencies]
axum = "0.7"
`);

    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.languages).toHaveLength(1);
    const ctx = result.languages[0];
    expect(ctx.language).toBe('rust');
    expect(ctx.frameworks).toContain('axum');
    expect(ctx.packageManager).toBe('cargo');
    expect(result.isPolyglot).toBe(false);
  });

  it('detects Rust monorepo when Cargo.toml has [workspace]', async () => {
    writeFile(path.join(tmpDir, 'Cargo.toml'), `[workspace]
members = ["crate-a", "crate-b"]
`);

    const result = await new ProjectDetector(tmpDir).detect();
    expect(result.languages[0].isMonorepo).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. PHP project
// ---------------------------------------------------------------------------
describe('PHP project', () => {
  it('detects php and laravel framework', async () => {
    writeFile(path.join(tmpDir, 'composer.json'), JSON.stringify({
      require: {
        'laravel/framework': '^10.0',
      },
    }));

    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.languages).toHaveLength(1);
    const ctx = result.languages[0];
    expect(ctx.language).toBe('php');
    expect(ctx.frameworks).toContain('laravel');
    expect(ctx.packageManager).toBe('composer');
    expect(result.isPolyglot).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Ruby project
// ---------------------------------------------------------------------------
describe('Ruby project', () => {
  it('detects ruby and rails framework', async () => {
    writeFile(path.join(tmpDir, 'Gemfile'), `source "https://rubygems.org"
gem "rails", "~> 7.0"
`);

    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.languages).toHaveLength(1);
    const ctx = result.languages[0];
    expect(ctx.language).toBe('ruby');
    expect(ctx.frameworks).toContain('rails');
    expect(ctx.packageManager).toBe('bundler');
    expect(result.isPolyglot).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. Polyglot project
// ---------------------------------------------------------------------------
describe('Polyglot project', () => {
  it('detects two LanguageContexts and isPolyglot true when root has JS and backend/ has Go', async () => {
    // Root: JS project
    writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'frontend',
      dependencies: { react: '^18.0.0' },
    }));

    // backend/ subdir: Go project
    const backendDir = path.join(tmpDir, 'backend');
    writeFile(path.join(backendDir, 'go.mod'), `module example.com/backend

go 1.21

require (
  github.com/gin-gonic/gin v1.9.0
)
`);

    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.isPolyglot).toBe(true);
    expect(result.languages).toHaveLength(2);

    const languages = result.languages.map(c => c.language);
    expect(languages).toContain('javascript');
    expect(languages).toContain('go');

    const goCtx = result.languages.find(c => c.language === 'go');
    expect(goCtx?.root).toBe(backendDir);
    expect(goCtx?.frameworks).toContain('gin');
  });
});

// ---------------------------------------------------------------------------
// 10. Empty directory
// ---------------------------------------------------------------------------
describe('empty directory', () => {
  it('returns empty languages array', async () => {
    const result = await new ProjectDetector(tmpDir).detect();

    expect(result.languages).toHaveLength(0);
    expect(result.isPolyglot).toBe(false);
    expect(result.projectRoot).toBe(tmpDir);
  });
});
