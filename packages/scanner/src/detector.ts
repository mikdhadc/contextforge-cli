import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DetectionResult, LanguageContext, Language, Framework, PackageManager } from './types.js';

// Signature files that indicate a language is present
const LANGUAGE_SIGNATURES: Record<Language, string[]> = {
  javascript: ['package.json'],
  typescript: ['package.json'],
  python: ['requirements.txt', 'pyproject.toml', 'setup.py', 'setup.cfg'],
  go: ['go.mod'],
  rust: ['Cargo.toml'],
  php: ['composer.json'],
  ruby: ['Gemfile'],
  java: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'build.xml'],
};

export class ProjectDetector {
  constructor(private readonly projectRoot: string) {}

  async detect(): Promise<DetectionResult> {
    const rootContexts = await this.detectInDirectory(this.projectRoot);

    // Step 2: Polyglot scan — walk one level of subdirectories
    const subdirContexts = await this.scanSubdirectories(rootContexts);

    const allContexts = [...rootContexts, ...subdirContexts];

    return {
      projectRoot: this.projectRoot,
      languages: allContexts,
      isPolyglot: allContexts.length > 1,
    };
  }

  private async detectInDirectory(dir: string): Promise<LanguageContext[]> {
    const contexts: LanguageContext[] = [];

    // Check JS/TS (both share package.json)
    const jsContext = await this.detectJsTs(dir);
    if (jsContext) contexts.push(jsContext);

    // Check other languages
    const otherLanguages: Array<Exclude<Language, 'javascript' | 'typescript'>> = [
      'python', 'go', 'rust', 'php', 'ruby', 'java',
    ];

    for (const lang of otherLanguages) {
      const sigFiles = LANGUAGE_SIGNATURES[lang];
      const foundSigs = sigFiles.filter(sig => fs.existsSync(path.join(dir, sig)));
      if (foundSigs.length > 0) {
        const ctx = await this.buildContext(lang, dir, foundSigs);
        contexts.push(ctx);
      }
    }

    return contexts;
  }

  private async scanSubdirectories(rootContexts: LanguageContext[]): Promise<LanguageContext[]> {
    const rootLanguages = new Set(rootContexts.map(c => c.language));
    // Normalize: if root has javascript or typescript, treat both as covered
    const jsLangs = new Set<Language>(['javascript', 'typescript']);
    const rootHasJs = rootLanguages.has('javascript') || rootLanguages.has('typescript');

    const subdirContexts: LanguageContext[] = [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.projectRoot, { withFileTypes: true });
    } catch {
      return [];
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip hidden dirs and common non-project dirs
      if (entry.name.startsWith('.')) continue;
      if (['node_modules', 'dist', 'build', '__pycache__', '.git', 'vendor'].includes(entry.name)) continue;

      const subdirPath = path.join(this.projectRoot, entry.name);
      const subdirContextsForDir = await this.detectInDirectory(subdirPath);

      for (const ctx of subdirContextsForDir) {
        // Skip if this language is already detected at root level
        const isJsOrTs = jsLangs.has(ctx.language);
        if (isJsOrTs && rootHasJs) continue;
        if (!isJsOrTs && rootLanguages.has(ctx.language)) continue;

        subdirContexts.push(ctx);
      }
    }

    return subdirContexts;
  }

  private async buildContext(
    language: Exclude<Language, 'javascript' | 'typescript'>,
    dir: string,
    signatureFiles: string[],
  ): Promise<LanguageContext> {
    const frameworks = await this.detectFrameworks(language, dir);
    const packageManager = this.detectPackageManager(language, dir);
    const isMonorepo = await this.detectMonorepo(language, dir);

    return {
      language,
      root: dir,
      frameworks,
      packageManager,
      isMonorepo,
      signatureFiles,
    };
  }

  // ----- JS / TS -----

  private async detectJsTs(dir: string): Promise<LanguageContext | null> {
    const pkgJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) return null;

    const language = this.resolveJsOrTs(dir);
    const frameworks = await this.detectFrameworks(language, dir);
    const packageManager = this.detectPackageManager(language, dir);
    const isMonorepo = await this.detectMonorepo(language, dir);

    return {
      language,
      root: dir,
      frameworks,
      packageManager,
      isMonorepo,
      signatureFiles: ['package.json'],
    };
  }

  private resolveJsOrTs(dir: string): Language {
    // Check if typescript is listed as a dependency
    const pkgJsonPath = path.join(dir, 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
      const deps = { ...(pkg['dependencies'] as Record<string, string> | undefined), ...(pkg['devDependencies'] as Record<string, string> | undefined) };
      if ('typescript' in deps) return 'typescript';
    } catch {
      // ignore
    }

    // Check for .ts files in src/
    const srcDir = path.join(dir, 'src');
    if (fs.existsSync(srcDir)) {
      try {
        const files = fs.readdirSync(srcDir);
        if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) return 'typescript';
      } catch {
        // ignore
      }
    }

    return 'javascript';
  }

  // ----- Framework detection -----

  private async detectFrameworks(language: Language, dir: string): Promise<Framework[]> {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return this.detectJsFrameworks(dir);
      case 'python':
        return this.detectPyFrameworks(dir);
      case 'go':
        return this.detectGoFrameworks(dir);
      case 'rust':
        return this.detectRustFrameworks(dir);
      case 'php':
        return this.detectPhpFrameworks(dir);
      case 'ruby':
        return this.detectRubyFrameworks(dir);
      case 'java':
        return this.detectJavaFrameworks(dir);
    }
  }

  private detectJsFrameworks(dir: string): Framework[] {
    const pkgJsonPath = path.join(dir, 'package.json');
    const frameworks: Framework[] = [];
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
      const deps: Record<string, string> = {
        ...(pkg['dependencies'] as Record<string, string> | undefined),
        ...(pkg['devDependencies'] as Record<string, string> | undefined),
      };

      if ('react' in deps) frameworks.push('react');
      if ('next' in deps) frameworks.push('next.js');
      if ('express' in deps) frameworks.push('express');
      if ('@nestjs/core' in deps) frameworks.push('nestjs');
      if ('vue' in deps) frameworks.push('vue');
      if ('svelte' in deps) frameworks.push('svelte');
    } catch {
      // ignore
    }
    return frameworks;
  }

  private detectPyFrameworks(dir: string): Framework[] {
    const frameworks: Framework[] = [];

    // Try pyproject.toml first
    const pyprojectPath = path.join(dir, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
      try {
        const content = fs.readFileSync(pyprojectPath, 'utf8').toLowerCase();
        if (content.includes('fastapi')) frameworks.push('fastapi');
        if (content.includes('django')) frameworks.push('django');
        if (content.includes('flask')) frameworks.push('flask');
        if (frameworks.length > 0) return frameworks;
      } catch {
        // ignore
      }
    }

    // Try requirements.txt
    const reqPath = path.join(dir, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      try {
        const content = fs.readFileSync(reqPath, 'utf8').toLowerCase();
        if (content.includes('fastapi')) frameworks.push('fastapi');
        if (content.includes('django')) frameworks.push('django');
        if (content.includes('flask')) frameworks.push('flask');
      } catch {
        // ignore
      }
    }

    return frameworks;
  }

  private detectGoFrameworks(dir: string): Framework[] {
    const frameworks: Framework[] = [];
    const goModPath = path.join(dir, 'go.mod');
    try {
      const content = fs.readFileSync(goModPath, 'utf8');
      if (content.includes('github.com/gin-gonic/gin')) frameworks.push('gin');
      if (content.includes('github.com/labstack/echo')) frameworks.push('echo');
    } catch {
      // ignore
    }
    return frameworks;
  }

  private detectRustFrameworks(dir: string): Framework[] {
    const frameworks: Framework[] = [];
    const cargoPath = path.join(dir, 'Cargo.toml');
    try {
      const content = fs.readFileSync(cargoPath, 'utf8');
      if (content.includes('actix-web')) frameworks.push('actix');
      if (content.includes('axum')) frameworks.push('axum');
    } catch {
      // ignore
    }
    return frameworks;
  }

  private detectPhpFrameworks(dir: string): Framework[] {
    const frameworks: Framework[] = [];
    const composerPath = path.join(dir, 'composer.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(composerPath, 'utf8')) as Record<string, unknown>;
      const require = (pkg['require'] as Record<string, string> | undefined) ?? {};
      if ('laravel/framework' in require) frameworks.push('laravel');
      if ('symfony/framework-bundle' in require) frameworks.push('symfony');
    } catch {
      // ignore
    }
    return frameworks;
  }

  private detectRubyFrameworks(dir: string): Framework[] {
    const frameworks: Framework[] = [];
    const gemfilePath = path.join(dir, 'Gemfile');
    try {
      const content = fs.readFileSync(gemfilePath, 'utf8').toLowerCase();
      if (content.includes('rails')) frameworks.push('rails');
      if (content.includes('sinatra')) frameworks.push('sinatra');
    } catch {
      // ignore
    }
    return frameworks;
  }

  private detectJavaFrameworks(dir: string): Framework[] {
    const frameworks: Framework[] = [];
    
    // Check pom.xml (Maven)
    const pomPath = path.join(dir, 'pom.xml');
    if (fs.existsSync(pomPath)) {
      try {
        const content = fs.readFileSync(pomPath, 'utf8').toLowerCase();
        if (content.includes('spring-boot-starter')) frameworks.push('spring-boot');
        else if (content.includes('org.springframework')) frameworks.push('spring');
        if (content.includes('quarkus')) frameworks.push('quarkus');
        if (content.includes('micronaut')) frameworks.push('micronaut');
        if (frameworks.length > 0) return frameworks;
      } catch {
        // ignore
      }
    }
    
    // Check build.gradle or build.gradle.kts (Gradle)
    const gradleFiles = ['build.gradle', 'build.gradle.kts'];
    for (const gradleFile of gradleFiles) {
      const gradlePath = path.join(dir, gradleFile);
      if (fs.existsSync(gradlePath)) {
        try {
          const content = fs.readFileSync(gradlePath, 'utf8').toLowerCase();
          if (content.includes('spring-boot-starter') || content.includes('org.springframework.boot')) frameworks.push('spring-boot');
          else if (content.includes('org.springframework')) frameworks.push('spring');
          if (content.includes('quarkus')) frameworks.push('quarkus');
          if (content.includes('micronaut')) frameworks.push('micronaut');
          if (frameworks.length > 0) return frameworks;
        } catch {
          // ignore
        }
      }
    }
    
    return frameworks;
  }

  // ----- Package manager detection -----

  private detectPackageManager(language: Language, dir: string): PackageManager | null {
    switch (language) {
      case 'javascript':
      case 'typescript': {
        if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
        if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
        if (fs.existsSync(path.join(dir, 'bun.lockb'))) return 'bun';
        if (fs.existsSync(path.join(dir, 'package.json'))) return 'npm';
        return null;
      }
      case 'python': {
        if (fs.existsSync(path.join(dir, 'poetry.lock'))) return 'poetry';
        if (fs.existsSync(path.join(dir, 'uv.lock'))) return 'uv';
        if (fs.existsSync(path.join(dir, 'Pipfile'))) return 'pipenv';
        return 'pip';
      }
      case 'go':
        return 'go mod';
      case 'rust':
        return 'cargo';
      case 'php':
        return 'composer';
      case 'ruby':
        return 'bundler';
      case 'java': {
        if (fs.existsSync(path.join(dir, 'pom.xml'))) return 'maven';
        if (fs.existsSync(path.join(dir, 'build.gradle')) || fs.existsSync(path.join(dir, 'build.gradle.kts'))) return 'gradle';
        if (fs.existsSync(path.join(dir, 'build.xml'))) return 'ant';
        return null;
      }
    }
  }

  // ----- Monorepo detection -----

  private async detectMonorepo(language: Language, dir: string): Promise<boolean> {
    switch (language) {
      case 'javascript':
      case 'typescript': {
        // Check for workspaces field in package.json
        const pkgJsonPath = path.join(dir, 'package.json');
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
          if ('workspaces' in pkg) return true;
        } catch {
          // ignore
        }
        // Check for pnpm-workspace.yaml
        if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return true;
        return false;
      }
      case 'python': {
        // Check if multiple setup.py / pyproject.toml exist in subdirs
        return this.hasMultipleFilesInSubdirs(dir, ['setup.py', 'pyproject.toml']);
      }
      case 'go': {
        // Check if multiple go.mod files exist in subdirs
        return this.hasMultipleFilesInSubdirs(dir, ['go.mod']);
      }
      case 'rust': {
        // Check if Cargo.toml has [workspace]
        const cargoPath = path.join(dir, 'Cargo.toml');
        try {
          const content = fs.readFileSync(cargoPath, 'utf8');
          return content.includes('[workspace]');
        } catch {
          return false;
        }
      }
      case 'java': {
        // Check if pom.xml has <modules> or if multiple pom.xml exist in subdirs
        const pomPath = path.join(dir, 'pom.xml');
        if (fs.existsSync(pomPath)) {
          try {
            const content = fs.readFileSync(pomPath, 'utf8');
            if (content.includes('<modules>')) return true;
          } catch {
            // ignore
          }
        }
        // Check for multiple build files in subdirs
        return this.hasMultipleFilesInSubdirs(dir, ['pom.xml', 'build.gradle', 'build.gradle.kts']);
      }
      default:
        return false;
    }
  }

  private hasMultipleFilesInSubdirs(dir: string, fileNames: string[]): boolean {
    let count = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (['node_modules', 'dist', 'build', '__pycache__', '.git', 'vendor'].includes(entry.name)) continue;
        const subdirPath = path.join(dir, entry.name);
        for (const fileName of fileNames) {
          if (fs.existsSync(path.join(subdirPath, fileName))) {
            count++;
            break;
          }
        }
        if (count >= 2) return true;
      }
    } catch {
      // ignore
    }
    return false;
  }
}
