import { Command } from 'commander';
import * as path from 'node:path';
import { runAllChecks } from '../audit/checks.js';
import { runInit } from './init.js';
import { runTemplatesApply } from './templates.js';
import type { AuditCheck, AuditReport } from '../audit/types.js';

const STATUS_ICON: Record<string, string> = {
  pass: '✓',
  warn: '⚠',
  fail: '✗',
};

export interface AuditOptions {
  root: string;
  json?: boolean;
  fix?: boolean;
}

function buildReport(projectRoot: string): AuditReport {
  const checks = runAllChecks(projectRoot);
  return {
    projectRoot,
    timestamp: new Date().toISOString(),
    checks,
    passed: checks.filter(c => c.status === 'pass').length,
    warned: checks.filter(c => c.status === 'warn').length,
    failed: checks.filter(c => c.status === 'fail').length,
  };
}

function printReport(report: AuditReport): void {
  console.log(`\nContextForge Audit — ${report.projectRoot}\n`);
  for (const check of report.checks) {
    const icon = STATUS_ICON[check.status];
    console.log(`  ${icon}  ${check.id.padEnd(28)} ${check.detail}`);
  }
  console.log(`\nPassed: ${report.passed}  Warned: ${report.warned}  Failed: ${report.failed}`);
}

function printFixSuggestion(checks: AuditCheck[]): void {
  const fixable = checks.filter(c => c.fixable && c.status !== 'pass');
  if (fixable.length > 0) {
    console.log(`\nRun \`contextforge audit --fix\` to auto-fix ${fixable.length} issue(s).`);
  }
}

async function applyFixes(projectRoot: string, checks: AuditCheck[]): Promise<void> {
  const needsInit = checks.some(
    c => c.fixable && c.status !== 'pass' &&
      ['context-exists', 'context-fresh', 'ide-file-present', 'sections-complete'].includes(c.id),
  );
  const needsTemplates = checks.some(
    c => c.fixable && c.status !== 'pass' && c.id === 'templates-applied',
  );

  if (needsInit) {
    console.log('Fixing: running init...');
    await runInit({ root: projectRoot, force: true });
  }

  if (needsTemplates) {
    console.log('Fixing: applying all templates...');
    runTemplatesApply(undefined, { root: projectRoot, all: true });
  }
}

export async function runAudit(opts: AuditOptions): Promise<void> {
  const projectRoot = path.resolve(opts.root);
  const report = buildReport(projectRoot);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
    if (!opts.fix) {
      printFixSuggestion(report.checks);
    }
  }

  if (opts.fix) {
    await applyFixes(projectRoot, report.checks);
    // Re-audit after fixes and print updated result
    const updated = buildReport(projectRoot);
    if (!opts.json) {
      console.log('\nRe-auditing after fixes...');
      printReport(updated);
    }
    process.exit(updated.failed > 0 ? 1 : 0);
  } else {
    process.exit(report.failed > 0 ? 1 : 0);
  }
}

export function auditCommand(): Command {
  return new Command('audit')
    .description('Check project health: context freshness, IDE files, conventions, templates')
    .option('--json', 'Output results as JSON')
    .option('--fix', 'Auto-fix issues that can be resolved automatically')
    .option('--root <dir>', 'Project root', process.cwd())
    .action((opts: AuditOptions) => runAudit(opts));
}
