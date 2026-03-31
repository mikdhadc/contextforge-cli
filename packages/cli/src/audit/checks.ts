import * as fs from 'node:fs';
import * as path from 'node:path';
import { isContextFresh } from '@contextforge/mcp';
import { IDEFileWriter, parseContextFile } from '@contextforge/generator';
import { getIdeTemplateConfig } from '../templates/writer.js';
import type { AuditCheck } from './types.js';

const EXPECTED_SECTIONS = ['stack', 'structure', 'conventions', 'dependencies', 'anti-patterns', 'decisions'];

/** .context.md must exist */
export function checkContextExists(projectRoot: string): AuditCheck {
  const exists = fs.existsSync(path.join(projectRoot, '.context.md'));
  return {
    id: 'context-exists',
    description: '.context.md exists',
    status: exists ? 'pass' : 'fail',
    detail: exists ? '.context.md found' : '.context.md missing — run `contextforge init`',
    fixable: !exists,
  };
}

/** Signature hash in .context.md must match the current codebase */
export function checkContextFresh(projectRoot: string): AuditCheck {
  const contextPath = path.join(projectRoot, '.context.md');
  if (!fs.existsSync(contextPath)) {
    return {
      id: 'context-fresh',
      description: '.context.md is up to date',
      status: 'fail',
      detail: '.context.md missing',
      fixable: true,
    };
  }
  const fresh = isContextFresh(projectRoot);
  return {
    id: 'context-fresh',
    description: '.context.md is up to date',
    status: fresh ? 'pass' : 'warn',
    detail: fresh ? 'Signature hash matches current codebase' : 'Signature hash stale — run `contextforge init`',
    fixable: !fresh,
  };
}

/** Detected IDE must have its native file present */
export function checkIdFilePresent(projectRoot: string): AuditCheck {
  const ideWriter = new IDEFileWriter(projectRoot);
  const ide = ideWriter.detectIde();

  if (!ide) {
    return {
      id: 'ide-file-present',
      description: 'IDE-specific file is written',
      status: 'warn',
      detail: 'No IDE detected — set CONTEXTFORGE_IDE or use `contextforge init --ide <target>`',
      fixable: false,
    };
  }

  const idePath = ideWriter.getTargetPath(ide);
  const exists = fs.existsSync(idePath);
  return {
    id: 'ide-file-present',
    description: 'IDE-specific file is written',
    status: exists ? 'pass' : 'warn',
    detail: exists
      ? `${ide}: ${idePath} found`
      : `${ide} detected but ${idePath} is missing — run \`contextforge init\``,
    fixable: !exists,
  };
}

/** All 6 standard sections must be present in .context.md */
export function checkSectionsComplete(projectRoot: string): AuditCheck {
  const contextPath = path.join(projectRoot, '.context.md');
  if (!fs.existsSync(contextPath)) {
    return {
      id: 'sections-complete',
      description: 'All standard sections present',
      status: 'fail',
      detail: '.context.md missing',
      fixable: true,
    };
  }

  const content = fs.readFileSync(contextPath, 'utf8');
  const parsed = parseContextFile(content);
  const present = new Set(parsed.sections.map(s => s.name));
  const missing = EXPECTED_SECTIONS.filter(s => !present.has(s));

  return {
    id: 'sections-complete',
    description: 'All standard sections present',
    status: missing.length === 0 ? 'pass' : 'warn',
    detail: missing.length === 0
      ? `All ${EXPECTED_SECTIONS.length} sections present`
      : `Missing sections: ${missing.join(', ')} — run \`contextforge init\``,
    fixable: missing.length > 0,
  };
}

/** Contested conventions require human review */
export function checkNoContestedConventions(projectRoot: string): AuditCheck {
  const contextPath = path.join(projectRoot, '.context.md');
  if (!fs.existsSync(contextPath)) {
    return {
      id: 'no-contested-conventions',
      description: 'No contested conventions',
      status: 'fail',
      detail: '.context.md missing',
      fixable: true,
    };
  }

  const content = fs.readFileSync(contextPath, 'utf8');
  // Renderer marks contested conventions with ⚠ Contested
  const matches = content.match(/⚠ Contested/g);
  const count = matches?.length ?? 0;

  return {
    id: 'no-contested-conventions',
    description: 'No contested conventions',
    status: count === 0 ? 'pass' : 'warn',
    detail: count === 0
      ? 'No contested conventions detected'
      : `${count} contested convention(s) — manual alignment required`,
    fixable: false,
  };
}

/** At least one slash command template must exist for the detected IDE */
export function checkTemplatesApplied(projectRoot: string): AuditCheck {
  const ideWriter = new IDEFileWriter(projectRoot);
  const ide = ideWriter.detectIde();

  if (!ide) {
    return {
      id: 'templates-applied',
      description: 'Slash command templates applied',
      status: 'warn',
      detail: 'No IDE detected — cannot check template directory',
      fixable: false,
    };
  }

  const { dir } = getIdeTemplateConfig(ide, projectRoot);
  const hasTemplates = fs.existsSync(dir) && fs.readdirSync(dir).length > 0;

  return {
    id: 'templates-applied',
    description: 'Slash command templates applied',
    status: hasTemplates ? 'pass' : 'warn',
    detail: hasTemplates
      ? `Templates found in ${dir}`
      : `No templates in ${dir} — run \`contextforge templates apply --all\``,
    fixable: !hasTemplates,
  };
}

export function runAllChecks(projectRoot: string): AuditCheck[] {
  return [
    checkContextExists(projectRoot),
    checkContextFresh(projectRoot),
    checkIdFilePresent(projectRoot),
    checkSectionsComplete(projectRoot),
    checkNoContestedConventions(projectRoot),
    checkTemplatesApplied(projectRoot),
  ];
}
