import { Command } from 'commander';
import * as path from 'node:path';
import { IDEFileWriter } from '@contextforge/generator';
import type { IdeTarget } from '@contextforge/generator';
import { TEMPLATE_CONTENT } from '../templates/content.js';
import { writeTemplate } from '../templates/writer.js';

export interface BuiltinTemplate {
  name: string;
  description: string;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { name: 'feature',  description: 'Scaffold a new feature with full context preamble' },
  { name: 'bugfix',   description: 'Bug investigation with stack context and decisions log' },
  { name: 'refactor', description: 'Structured refactor with impact analysis' },
  { name: 'review',   description: 'Code review checklist using project conventions' },
  { name: 'explain',  description: 'Deep-dive explanation of a file or concept' },
];

export interface ApplyOptions {
  ide?: IdeTarget;
  root: string;
  all?: boolean;
}

export function runTemplatesList(): void {
  console.log('Available templates:\n');
  for (const t of BUILTIN_TEMPLATES) {
    console.log(`  ${t.name.padEnd(12)}${t.description}`);
  }
}

function resolveTargets(name: string | undefined, all: boolean | undefined): string[] {
  if (all) return BUILTIN_TEMPLATES.map(t => t.name);
  return name ? [name] : [];
}

function applyTargets(targets: string[], ide: IdeTarget, projectRoot: string): void {
  const unknown = targets.filter(t => !TEMPLATE_CONTENT[t]);
  if (unknown.length > 0) {
    console.error(`Unknown template: ${unknown[0]}. Run \`contextforge templates list\` to see options.`);
    process.exit(1);
  } else {
    for (const target of targets) {
      const { filePath } = writeTemplate(target, TEMPLATE_CONTENT[target], ide, projectRoot);
      console.log(`Wrote ${filePath}`);
    }
  }
}

export function runTemplatesApply(name: string | undefined, opts: ApplyOptions): void {
  const projectRoot = path.resolve(opts.root);
  const ideWriter = new IDEFileWriter(projectRoot);
  const ide = opts.ide ?? ideWriter.detectIde();

  if (!ide) {
    console.error('No IDE detected. Use --ide <target> to specify one.');
    process.exit(1);
  } else {
    const targets = resolveTargets(name, opts.all);
    if (targets.length === 0) {
      console.error('Specify a template name or use --all. Run `contextforge templates list` to see options.');
      process.exit(1);
    } else {
      applyTargets(targets, ide, projectRoot);
    }
  }
}

export function templatesCommand(): Command {
  const cmd = new Command('templates')
    .description('Manage slash command templates');

  cmd.command('list')
    .description('List available templates')
    .action(() => runTemplatesList());

  cmd.command('apply [name]')
    .description('Write a template to the IDE slash-command directory')
    .option('--ide <ide>', 'Override IDE target (claude-code|cursor|windsurf|vscode|antigravity)')
    .option('--all', 'Apply all built-in templates at once')
    .option('--root <dir>', 'Project root', process.cwd())
    .action((name: string | undefined, opts: ApplyOptions) => runTemplatesApply(name, opts));

  return cmd;
}
