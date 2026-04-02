import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratorInput, SectionName } from './types.js';
import type { ConventionOccurrence, LanguageContext } from '@contextforge/scanner';
import { sha256Short } from './hash.js';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderOccurrence(label: string, occ: ConventionOccurrence | null): string {
  if (!occ) return '';
  const pct = Math.round(occ.confidence * 100);
  let out = `**${label}:** ${occ.pattern} (${pct}% confidence)`;
  if (occ.contested && occ.minority.length > 0) {
    const minorities = occ.minority.map(m => `${m.pattern} found in ${m.locations.slice(0, 3).join(', ')}`);
    out += `\n⚠ Contested: ${minorities.join('; ')}`;
  }
  return out;
}

function renderStackSection(input: GeneratorInput): string {
  const { detection } = input;
  const lines: string[] = [
    '## Stack',
    '',
    `**Languages:** ${detection.languages.map(l => capitalize(l.language)).join(', ')}`,
  ];

  const pmParts = detection.languages
    .filter(l => l.packageManager)
    .map(l => `${l.packageManager} (${capitalize(l.language)})`);
  if (pmParts.length > 0) {
    lines.push(`**Package manager:** ${pmParts.join(', ')}`);
  }

  const monoRepoLangs = detection.languages.filter(l => l.isMonorepo);
  if (monoRepoLangs.length > 0) {
    lines.push(`**Monorepo:** Yes (${monoRepoLangs.map(l => capitalize(l.language)).join(', ')})`);
  }

  for (const lang of detection.languages) {
    lines.push('');
    lines.push(`### ${capitalize(lang.language)}`);
    if (lang.packageManager?.includes('go') || lang.language === 'go') {
      lines.push(`- Runtime: Go`);
    } else if (lang.language === 'typescript' || lang.language === 'javascript') {
      lines.push(`- Runtime: Node.js`);
    } else if (lang.language === 'python') {
      lines.push(`- Runtime: Python`);
    } else if (lang.language === 'rust') {
      lines.push(`- Runtime: Rust`);
    } else if (lang.language === 'ruby') {
      lines.push(`- Runtime: Ruby`);
    } else if (lang.language === 'php') {
      lines.push(`- Runtime: PHP`);
    }
    if (lang.frameworks.length > 0) {
      lines.push(`- Frameworks: ${lang.frameworks.map(f => capitalize(f)).join(', ')}`);
    }
  }

  return lines.join('\n');
}

function renderStructureSection(input: GeneratorInput): string {
  const { detection, conventions } = input;
  const lines: string[] = ['## Project Structure', ''];

  for (const lang of detection.languages) {
    const conventionSet = conventions.get(lang.root);
    lines.push(`### ${capitalize(lang.language)}`);

    if (conventionSet) {
      const { folderStructure: fld } = conventionSet;
      const sourceLabel = fld.sourceDir ? `\`${fld.sourceDir}/\`` : '(none detected)';
      const testLabel   = fld.testDir   ? `\`${fld.testDir}/\``   : '(none detected)';
      lines.push(
        `- Source: ${sourceLabel}`,
        `- Tests: ${testLabel}`,
        `- Config dir: ${fld.hasConfigDir ? 'Yes' : 'No'}`,
      );
    } else {
      lines.push('- Source: (none detected)', '- Tests: (none detected)');
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function renderConventionsSection(input: GeneratorInput): string {
  const { detection, conventions } = input;
  const lines: string[] = ['## Conventions', ''];

  for (const lang of detection.languages) {
    const conventionSet = conventions.get(lang.root);
    lines.push(`### ${capitalize(lang.language)}`, '');

    if (!conventionSet) {
      lines.push('(no conventions detected)', '');
      continue;
    }

    const { naming, imports, exports, tests } = conventionSet;

    const occurrences: string[] = [];

    const fnOcc = renderOccurrence('Function naming', naming.functions);
    if (fnOcc) occurrences.push(fnOcc);

    const classOcc = renderOccurrence('Class naming', naming.classes);
    if (classOcc) occurrences.push(classOcc);

    const varOcc = renderOccurrence('Variable naming', naming.variables);
    if (varOcc) occurrences.push(varOcc);

    const constOcc = renderOccurrence('Constant naming', naming.constants);
    if (constOcc) occurrences.push(constOcc);

    const importOcc = renderOccurrence('Import style', imports.dominant);
    if (importOcc) occurrences.push(importOcc);

    if (exports) {
      const exportOcc = renderOccurrence('Export style', exports.dominant);
      if (exportOcc) occurrences.push(exportOcc);
    }

    const testPatternOcc = renderOccurrence('Test file pattern', tests.filePattern);
    if (testPatternOcc) occurrences.push(testPatternOcc);
    if (tests.framework) occurrences.push(`**Test framework:** ${tests.framework}`);

    lines.push(...occurrences, '');
  }

  return lines.join('\n').trimEnd();
}

function readPackageJsonDeps(root: string): string[] {
  try {
    const pkgPath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps: Record<string, string> = {};
    if (pkg.dependencies) Object.assign(deps, pkg.dependencies);
    if (pkg.devDependencies) Object.assign(deps, pkg.devDependencies);
    return Object.keys(deps).sort((a, b) => a.localeCompare(b)).slice(0, 10).map(k => `- ${k}: ${deps[k]}`);
  } catch {
    return [];
  }
}

function readRequirementsTxt(root: string): string[] {
  try {
    const content = fs.readFileSync(path.join(root, 'requirements.txt'), 'utf8');
    return content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'))
      .slice(0, 10)
      .map(l => `- ${l}`);
  } catch {
    return [];
  }
}

function readPyprojectToml(root: string): string[] {
  try {
    const content = fs.readFileSync(path.join(root, 'pyproject.toml'), 'utf8');
    const lines: string[] = [];
    let inDeps = false;
    for (const line of content.split('\n')) {
      if (line.trim() === '[tool.poetry.dependencies]' || line.trim() === '[project]') {
        inDeps = true;
        continue;
      }
      if (inDeps && line.startsWith('[')) break;
      if (inDeps) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          lines.push(`- ${trimmed}`);
        }
      }
    }
    return lines.slice(0, 10);
  } catch {
    return [];
  }
}

function readGoMod(root: string): string[] {
  try {
    const content = fs.readFileSync(path.join(root, 'go.mod'), 'utf8');
    const lines: string[] = [];
    let inRequire = false;
    for (const line of content.split('\n')) {
      if (line.trim() === 'require (') {
        inRequire = true;
        continue;
      }
      if (inRequire && line.trim() === ')') break;
      if (inRequire) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('//')) {
          lines.push(`- ${trimmed}`);
        }
      } else if (line.startsWith('require ') && !line.includes('(')) {
        lines.push(`- ${line.replace(/^require\s+/, '').trim()}`);
      }
    }
    return lines.slice(0, 10);
  } catch {
    return [];
  }
}

function readCargoToml(root: string): string[] {
  try {
    const content = fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf8');
    const lines: string[] = [];
    let inDeps = false;
    for (const line of content.split('\n')) {
      if (line.trim() === '[dependencies]') {
        inDeps = true;
        continue;
      }
      if (inDeps && line.startsWith('[')) break;
      if (inDeps) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          lines.push(`- ${trimmed}`);
        }
      }
    }
    return lines.slice(0, 10);
  } catch {
    return [];
  }
}

function readComposerJson(root: string): string[] {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'composer.json'), 'utf8'));
    const deps: Record<string, string> = {};
    if (pkg.require) Object.assign(deps, pkg.require);
    if (pkg['require-dev']) Object.assign(deps, pkg['require-dev']);
    return Object.keys(deps).sort((a, b) => a.localeCompare(b)).slice(0, 10).map(k => `- ${k}: ${deps[k]}`);
  } catch {
    return [];
  }
}

function readGemfile(root: string): string[] {
  try {
    const content = fs.readFileSync(path.join(root, 'Gemfile'), 'utf8');
    return content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('gem '))
      .slice(0, 10)
      .map(l => `- ${l}`);
  } catch {
    return [];
  }
}

function readPomXml(root: string): string[] {
  try {
    const content = fs.readFileSync(path.join(root, 'pom.xml'), 'utf8');
    const lines: string[] = [];
    let inDeps = false;
    let currentDep = '';
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      
      if (trimmed === '<dependencies>') {
        inDeps = true;
        continue;
      }
      if (trimmed === '</dependencies>') break;
      
      if (inDeps) {
        if (trimmed === '<dependency>') {
          currentDep = '';
        } else if (trimmed === '</dependency>') {
          if (currentDep) lines.push(`- ${currentDep}`);
          currentDep = '';
        } else if (trimmed.startsWith('<groupId>')) {
          const groupId = trimmed.replace(/<\/?groupId>/g, '');
          currentDep = groupId;
        } else if (trimmed.startsWith('<artifactId>')) {
          const artifactId = trimmed.replace(/<\/?artifactId>/g, '');
          if (currentDep) currentDep += ':' + artifactId;
        } else if (trimmed.startsWith('<version>')) {
          const version = trimmed.replace(/<\/?version>/g, '');
          if (currentDep) currentDep += ':' + version;
        }
      }
    }
    return lines.slice(0, 10);
  } catch {
    return [];
  }
}

function readGradleDeps(root: string): string[] {
  const gradleFiles = ['build.gradle', 'build.gradle.kts'];
  
  for (const gradleFile of gradleFiles) {
    try {
      const content = fs.readFileSync(path.join(root, gradleFile), 'utf8');
      const lines: string[] = [];
      
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        // Match implementation, api, compile, etc.
        const depMatch = trimmed.match(/(?:implementation|api|compile|testImplementation|runtimeOnly)\s*[("']([^"']+)["')]/);
        if (depMatch) {
          lines.push(`- ${depMatch[1]}`);
        }
      }
      
      if (lines.length > 0) return lines.slice(0, 10);
    } catch {
      continue;
    }
  }
  
  return [];
}

function renderDependenciesForLang(lang: LanguageContext): string[] {
  const { language, root } = lang;
  switch (language) {
    case 'typescript':
    case 'javascript':
      return readPackageJsonDeps(root);
    case 'python': {
      const reqs = readRequirementsTxt(root);
      return reqs.length > 0 ? reqs : readPyprojectToml(root);
    }
    case 'go':
      return readGoMod(root);
    case 'rust':
      return readCargoToml(root);
    case 'php':
      return readComposerJson(root);
    case 'ruby':
      return readGemfile(root);
    case 'java': {
      const pomDeps = readPomXml(root);
      return pomDeps.length > 0 ? pomDeps : readGradleDeps(root);
    }
    default:
      return [];
  }
}

function renderDependenciesSection(input: GeneratorInput): string {
  const { detection } = input;
  const lines: string[] = ['## Key Dependencies', ''];

  for (const lang of detection.languages) {
    lines.push(`### ${capitalize(lang.language)}`);
    const deps = renderDependenciesForLang(lang);
    if (deps.length > 0) {
      lines.push(...deps);
    } else {
      lines.push('(no dependencies detected)');
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function renderAntiPatternsSection(_input: GeneratorInput): string {
  return [
    '## Anti-Patterns',
    '',
    '> No anti-patterns recorded yet. Add them manually in the manual override block below,',
    '> or they will be populated as contextforge learns from your codebase.',
  ].join('\n');
}

function renderDecisionsSection(input: GeneratorInput): string {
  const decisionsPath = path.join(input.projectRoot, '.contextforge', 'decisions.jsonl');
  try {
    const content = fs.readFileSync(decisionsPath, 'utf8');
    const lines = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      return renderDecisionsPlaceholder();
    }

    interface Decision { title?: string; decision?: string; date?: string; context?: string; outcome?: string; }

    const decisions = lines.map(l => {
      try {
        return JSON.parse(l) as Decision;
      } catch {
        return null;
      }
    }).filter(Boolean) as Decision[];

    if (decisions.length === 0) return renderDecisionsPlaceholder();

    const result: string[] = ['## Architectural Decisions', ''];
    for (const d of decisions) {
      const title   = d.title ?? d.decision ?? 'Untitled';
      const dateStr = d.date ?? '';
      const ctxStr  = d.context ?? '';
      const outStr  = d.outcome ?? '';
      const datePart = dateStr ? ` (${dateStr})` : '';
      result.push(`### ${title}${datePart}`);
      if (ctxStr) result.push('', `**Context:** ${ctxStr}`);
      if (outStr) result.push('', `**Outcome:** ${outStr}`);
      result.push('');
    }
    return result.join('\n').trimEnd();
  } catch {
    return renderDecisionsPlaceholder();
  }
}

function renderDecisionsPlaceholder(): string {
  return [
    '## Architectural Decisions',
    '',
    '> No decisions logged yet. Use `contextforge log-decision` or the MCP `log_decision` tool.',
  ].join('\n');
}

export function renderAllSections(
  input: GeneratorInput,
): Map<SectionName, { content: string; inputHash: string }> {
  const result = new Map<SectionName, { content: string; inputHash: string }>();

  const stackContent = renderStackSection(input);
  result.set('stack', {
    content: stackContent,
    inputHash: sha256Short(JSON.stringify(input.detection)),
  });

  const structureContent = renderStructureSection(input);
  result.set('structure', {
    content: structureContent,
    inputHash: sha256Short(JSON.stringify(input.detection) + JSON.stringify(Array.from(input.conventions.entries()))),
  });

  const conventionsContent = renderConventionsSection(input);
  result.set('conventions', {
    content: conventionsContent,
    inputHash: sha256Short(JSON.stringify(Array.from(input.conventions.entries()))),
  });

  const depsContent = renderDependenciesSection(input);
  result.set('dependencies', {
    content: depsContent,
    inputHash: sha256Short(JSON.stringify(input.detection.languages.map(l => l.root))),
  });

  const antiPatternsContent = renderAntiPatternsSection(input);
  result.set('anti-patterns', {
    content: antiPatternsContent,
    inputHash: sha256Short('anti-patterns-static'),
  });

  const decisionsContent = renderDecisionsSection(input);
  result.set('decisions', {
    content: decisionsContent,
    inputHash: sha256Short(input.projectRoot + '-decisions'),
  });

  return result;
}
