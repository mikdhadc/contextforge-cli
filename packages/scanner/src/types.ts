export type Language = 'javascript' | 'typescript' | 'python' | 'go' | 'rust' | 'php' | 'ruby' | 'java';

export type JsFramework = 'react' | 'next.js' | 'express' | 'nestjs' | 'vue' | 'svelte';
export type PyFramework = 'fastapi' | 'django' | 'flask';
export type GoFramework = 'gin' | 'echo';
export type RustFramework = 'actix' | 'axum';
export type PhpFramework = 'laravel' | 'symfony';
export type RubyFramework = 'rails' | 'sinatra';
export type JavaFramework = 'spring-boot' | 'spring' | 'quarkus' | 'micronaut';
export type Framework = JsFramework | PyFramework | GoFramework | RustFramework | PhpFramework | RubyFramework | JavaFramework;

export type PackageManager =
  | 'npm' | 'pnpm' | 'yarn' | 'bun'          // JS
  | 'pip' | 'poetry' | 'uv' | 'pipenv'       // Python
  | 'go mod'                                   // Go
  | 'cargo'                                    // Rust
  | 'composer'                                 // PHP
  | 'bundler'                                  // Ruby
  | 'maven' | 'gradle' | 'ant';                // Java

export interface LanguageContext {
  language: Language;
  root: string;           // absolute path to the sub-directory that owns this language
  frameworks: Framework[];
  packageManager: PackageManager | null;
  isMonorepo: boolean;
  signatureFiles: string[]; // which signature files triggered detection
}

export interface DetectionResult {
  projectRoot: string;
  languages: LanguageContext[];
  isPolyglot: boolean;     // true if more than one language found
}
