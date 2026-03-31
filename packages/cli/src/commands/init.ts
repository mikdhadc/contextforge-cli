import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { runFullPipeline, isContextFresh, ContextCache } from '@contextforge/mcp';
import { IDEFileWriter } from '@contextforge/generator';
import type { IdeTarget } from '@contextforge/generator';
import { bootstrap } from '@contextforge/bootstrapper';
import { TEMPLATE_CONTENT } from '../templates/content.js';
import { writeTemplate } from '../templates/writer.js';
import { BUILTIN_TEMPLATES } from './templates.js';

export interface InitOptions {
  ide?: IdeTarget;
  force?: boolean;
  root: string;
  templates?: boolean;
  gitignore?: boolean;
}

class PromptManager {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.toLowerCase().trim());
      });
    });
  }

  async select(question: string, options: string[]): Promise<string> {
    console.log(`\n${question}`);
    options.forEach((opt, idx) => {
      console.log(`  ${idx + 1}) ${opt}`);
    });

    while (true) {
      const answer = await this.ask('Select an option (number): ');
      const idx = parseInt(answer, 10);

      if (idx >= 1 && idx <= options.length) {
        return options[idx - 1];
      }
      console.log('Invalid selection. Please try again.');
    }
  }

  close(): void {
    this.rl.close();
  }
}

async function applyTemplates(ide: IdeTarget, projectRoot: string): Promise<string[]> {
  const createdFiles: string[] = [];

  for (const template of BUILTIN_TEMPLATES) {
    const { filePath } = writeTemplate(template.name, TEMPLATE_CONTENT[template.name], ide, projectRoot);
    createdFiles.push(filePath);
    console.log(`Wrote ${filePath}`);
  }

  return createdFiles;
}

function addToGitignore(projectRoot: string, entries: string[]): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const relativePaths = entries.map(filePath => {
    const relative = path.relative(projectRoot, filePath);
    // Preserve directory marker (trailing sep)
    const endsWithSep = filePath.endsWith(path.sep) || filePath.endsWith('/');
    // Normalize to use forward slashes for .gitignore
    const normalized = relative.split(path.sep).join('/');
    return endsWithSep && !normalized.endsWith('/') ? normalized + '/' : normalized;
  });

  // Extract unique top-level directories and root-level files
  const uniqueEntries = new Set<string>();
  const addedTopDirs = new Set<string>();

  for (const entry of relativePaths) {
    if (entry.includes('/')) {
      // For files in subdirs, add only the top-level directory
      const topDir = entry.split('/')[0];
      if (!addedTopDirs.has(topDir)) {
        uniqueEntries.add(topDir + '/');
        addedTopDirs.add(topDir);
      }
    } else if (!entry.endsWith('/')) {
      // Regular file at root level
      uniqueEntries.add(entry);
    }
  }

  let gitignoreContent = '';
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  const entriesToAdd = Array.from(uniqueEntries).filter(
    entry => !gitignoreContent.includes(entry)
  );

  if (entriesToAdd.length === 0) {
    console.log('All entries already in .gitignore');
    return;
  }

  const newContent = gitignoreContent + (gitignoreContent.endsWith('\n') ? '' : '\n') + entriesToAdd.join('\n') + '\n';
  fs.writeFileSync(gitignorePath, newContent, 'utf8');
  console.log(`Added to .gitignore: ${entriesToAdd.join(', ')}`);
}

const SUPPORTED_IDES: IdeTarget[] = ['claude-code', 'cursor', 'windsurf', 'vscode', 'antigravity', 'bob'];

export async function runInit(opts: InitOptions): Promise<void> {
  const projectRoot = path.resolve(opts.root);

  if (!opts.force && isContextFresh(projectRoot)) {
    console.log('Context is already fresh. Use --force to regenerate.');
    return;
  }

  const createdItems: string[] = [];
  let ide = opts.ide;

  // Prompt for IDE selection if not provided and in interactive mode
  if (!ide && process.stdin.isTTY) {
    const promptManager = new PromptManager();
    try {
      const selected = await promptManager.select(
        '\nWhich IDE are you using?',
        SUPPORTED_IDES
      );
      ide = selected as IdeTarget;
    } finally {
      promptManager.close();
    }
  }

  // One-time setup: .contextforge/ dir, config.json, decisions.jsonl, MCP config
  const bootstrapped = bootstrap(projectRoot, { ide });
  if (!bootstrapped.alreadyBootstrapped) {
    console.log('Bootstrapped .contextforge/ and MCP server config.');
    createdItems.push(path.join(projectRoot, '.contextforge'));
  }

  // Track MCP config file based on IDE
  let mcpConfigPath = path.join(projectRoot, '.mcp.json');
  let ideDir = '';

  if (ide) {
    switch (ide) {
      case 'cursor':
        mcpConfigPath = path.join(projectRoot, '.cursor', 'mcp.json');
        ideDir = path.join(projectRoot, '.cursor') + path.sep;
        break;
      case 'windsurf':
        mcpConfigPath = path.join(projectRoot, '.windsurf', 'mcp.json');
        ideDir = path.join(projectRoot, '.windsurf') + path.sep;
        break;
      case 'vscode':
        mcpConfigPath = path.join(projectRoot, '.vscode', 'mcp.json');
        ideDir = path.join(projectRoot, '.vscode') + path.sep;
        break;
      case 'antigravity':
        mcpConfigPath = path.join(projectRoot, '.antigravity', 'mcp.json');
        ideDir = path.join(projectRoot, '.antigravity') + path.sep;
        break;
      case 'bob':
        mcpConfigPath = path.join(projectRoot, '.bob', 'mcp.json');
        ideDir = path.join(projectRoot, '.bob') + path.sep;
        break;
      // claude-code uses .mcp.json at root (default)
    }
  }
  createdItems.push(mcpConfigPath);

  // Add IDE-specific directory to ignore list only if not empty
  if (ideDir) {
    createdItems.push(ideDir);
  }

  console.log('Scanning project...');

  const cache = new ContextCache();
  await runFullPipeline(projectRoot, cache);

  const ideWriter = new IDEFileWriter(projectRoot);
  const detectedIde = ideWriter.detectIde();

  console.log('Generated .context.md');
  createdItems.push(path.join(projectRoot, '.context.md'));
  if (detectedIde) {
    console.log(`Wrote ${ideWriter.getTargetPath(detectedIde)}`);
    createdItems.push(ideWriter.getTargetPath(detectedIde));
  }

  let shouldApplyTemplates = opts.templates === undefined ? true : opts.templates;
  let shouldAddToGitignore = opts.gitignore === undefined ? true : opts.gitignore;

  // Show interactive prompts only if stdin is a TTY and options not explicitly set
  if (process.stdin.isTTY && opts.templates === undefined && opts.gitignore === undefined) {
    const promptManager = new PromptManager();

    try {
      // Prompt to apply templates
      if (detectedIde) {
        const response = await promptManager.ask('\nApply slash command templates? (yes/no): ');
        shouldApplyTemplates = response === 'yes' || response === 'y';
      }

      // Prompt to add to .gitignore
      const response = await promptManager.ask('Add newly created files/directories to .gitignore? (yes/no): ');
      shouldAddToGitignore = response === 'yes' || response === 'y';
    } finally {
      promptManager.close();
    }
  }

  // Apply templates if requested
  if (shouldApplyTemplates && detectedIde) {
    const templateFiles = await applyTemplates(detectedIde, projectRoot);
    createdItems.push(...templateFiles);
  }

  // Add to .gitignore if requested
  if (shouldAddToGitignore) {
    addToGitignore(projectRoot, createdItems);
  }

  console.log('\n✓ Project initialized successfully!');
}

export function initCommand(): Command {
  return new Command('init')
    .description('Scan the project and generate .context.md')
    .option('--ide <ide>', 'Override IDE target (claude-code|cursor|windsurf|vscode|antigravity|bob)')
    .option('--force', 'Re-generate even if context is fresh')
    .option('--root <dir>', 'Project root', process.cwd())
    .option('--templates', 'Apply slash command templates (default: true in interactive mode)')
    .option('--no-templates', 'Skip applying slash command templates')
    .option('--gitignore', 'Add created files to .gitignore (default: true)')
    .option('--no-gitignore', 'Skip adding to .gitignore')
    .action((opts) => runInit(opts));
}
