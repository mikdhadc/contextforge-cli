import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isContextFresh } from '@contextforge/mcp';
import { IDEFileWriter, parseContextFile } from '@contextforge/generator';

export interface StatusOptions {
  root: string;
}

export function runStatus(opts: StatusOptions): void {
  const projectRoot = path.resolve(opts.root);
  const contextPath = path.join(projectRoot, '.context.md');

  if (!fs.existsSync(contextPath)) {
    console.log('Status: not initialized');
    console.log('Run `contextforge init` to get started.');
    return;
  }

  const content = fs.readFileSync(contextPath, 'utf8');
  const fresh = isContextFresh(projectRoot);
  const lastUpdated = content.match(/Last updated: (.+)/)?.[1] ?? 'unknown';
  const sigHash = content.match(/Signature hash: ([a-f0-9]+)/)?.[1] ?? 'unknown';

  const parsed = parseContextFile(content);
  const sectionNames = parsed.sections.map(s => s.name);

  const ideWriter = new IDEFileWriter(projectRoot);
  const ide = ideWriter.detectIde();

  console.log(`Status:       ${fresh ? 'fresh' : 'stale'}`);
  console.log(`Last updated: ${lastUpdated}`);
  console.log(`Sig hash:     ${sigHash}`);
  console.log(`Sections:     ${sectionNames.join(', ') || '(none)'}`);
  console.log(`IDE:          ${ide ?? 'not detected'}`);

  if (ide) {
    const idePath = ideWriter.getTargetPath(ide);
    const ideExists = fs.existsSync(idePath);
    console.log(`IDE file:     ${idePath} ${ideExists ? '' : '(missing — run `contextforge init`)'}`);
  }
}

export function statusCommand(): Command {
  return new Command('status')
    .description('Show context freshness and detected IDE')
    .option('--root <dir>', 'Project root', process.cwd())
    .action((opts: StatusOptions) => runStatus(opts));
}
