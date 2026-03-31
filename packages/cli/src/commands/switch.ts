import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IDEFileWriter } from '@contextforge/generator';
import type { IdeTarget } from '@contextforge/generator';

const VALID_IDES: IdeTarget[] = ['claude-code', 'cursor', 'windsurf', 'vscode', 'antigravity', 'bob'];

export interface SwitchOptions {
  root: string;
}

export async function runSwitch(ide: IdeTarget, opts: SwitchOptions): Promise<void> {
  if (!VALID_IDES.includes(ide)) {
    console.error(`Invalid IDE target: ${ide}. Choose from: ${VALID_IDES.join(', ')}`);
    process.exit(1);
    return;
  }

  const projectRoot = path.resolve(opts.root);
  const contextPath = path.join(projectRoot, '.context.md');

  if (!fs.existsSync(contextPath)) {
    console.error('.context.md not found. Run `contextforge init` first.');
    process.exit(1);
    return;
  }

  const content = fs.readFileSync(contextPath, 'utf8');
  const ideWriter = new IDEFileWriter(projectRoot);
  const formatted = ideWriter.formatForIde(ide, content);
  ideWriter.write(ide, formatted);

  console.log(`Switched to ${ide}: ${ideWriter.getTargetPath(ide)}`);
}

export function switchCommand(): Command {
  return new Command('switch')
    .description('Write an IDE-specific file from the current .context.md')
    .argument('<ide>', 'Target IDE (claude-code|cursor|windsurf|vscode|antigravity|bob)')
    .option('--root <dir>', 'Project root', process.cwd())
    .action((ide: string, opts: SwitchOptions) => runSwitch(ide as IdeTarget, opts));
}
