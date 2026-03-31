import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IdeTarget } from '@contextforge/generator';

/**
 * Where each IDE expects its slash-command / rules files to live,
 * and what file extension + optional frontmatter each format requires.
 */
export interface IdeTemplateConfig {
  dir: string;
  ext: string;
  /** Optional content to prepend before the template body */
  preamble?: string;
}

export function getIdeTemplateConfig(ide: IdeTarget, projectRoot: string): IdeTemplateConfig {
  switch (ide) {
    case 'claude-code':
      return {
        dir: path.join(projectRoot, '.claude', 'commands'),
        ext: '.md',
      };
    case 'cursor':
      return {
        dir: path.join(projectRoot, '.cursor', 'rules'),
        ext: '.mdc',
        preamble: '---\ndescription: ContextForge slash command\nglobs: \nalwaysApply: false\n---\n\n',
      };
    case 'windsurf':
      return {
        dir: path.join(projectRoot, '.windsurf', 'rules'),
        ext: '.md',
      };
    case 'vscode':
      return {
        dir: path.join(projectRoot, '.github', 'instructions'),
        ext: '.instructions.md',
        preamble: '---\napplyTo: \'**\'\n---\n\n',
      };
    case 'antigravity':
      return {
        dir: path.join(projectRoot, '.antigravity', 'commands'),
        ext: '.md',
      };
    case 'bob':
      return {
        dir: path.join(projectRoot, '.bob', 'commands'),
        ext: '.md',
      };
  }
}

export interface WriteTemplateResult {
  filePath: string;
  ide: IdeTarget;
}

export function writeTemplate(
  name: string,
  body: string,
  ide: IdeTarget,
  projectRoot: string,
): WriteTemplateResult {
  const config = getIdeTemplateConfig(ide, projectRoot);
  fs.mkdirSync(config.dir, { recursive: true });

  const content = config.preamble ? config.preamble + body : body;
  const filePath = path.join(config.dir, `${name}${config.ext}`);
  fs.writeFileSync(filePath, content, 'utf8');

  return { filePath, ide };
}
