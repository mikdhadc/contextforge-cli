import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { serveCommand } from './commands/serve.js';
import { switchCommand } from './commands/switch.js';
import { statusCommand } from './commands/status.js';
import { templatesCommand } from './commands/templates.js';
import { auditCommand } from './commands/audit.js';

export { runInit } from './commands/init.js';
export { runServe } from './commands/serve.js';
export { runSwitch } from './commands/switch.js';
export { runStatus } from './commands/status.js';
export { runTemplatesList } from './commands/templates.js';
export { runAudit } from './commands/audit.js';

export function run(argv: string[]): void {
  const program = new Command()
    .name('contextforge')
    .description('AI context management for your codebase')
    .version('0.1.0');

  program.addCommand(initCommand());
  program.addCommand(serveCommand());
  program.addCommand(switchCommand());
  program.addCommand(statusCommand());
  program.addCommand(templatesCommand());
  program.addCommand(auditCommand());

  program.parse(argv);
}
