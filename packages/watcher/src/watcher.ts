import { EventEmitter } from 'node:events';
import chokidar, { type FSWatcher } from 'chokidar';
import type { ChangeEvent } from './types.js';
import { classifyPath } from './classify.js';

export interface ProjectWatcherOptions {
  /** Debounce delay in milliseconds (default: 2000) */
  debounceMs?: number;
}

/**
 * Watches a project root for meaningful file-system changes and emits
 * typed ChangeEvents after a debounce window.
 *
 * Usage:
 *   const watcher = new ProjectWatcher('/path/to/project');
 *   watcher.on('change', (event: ChangeEvent) => { ... });
 *   await watcher.start();
 *   // later:
 *   await watcher.stop();
 */
export class ProjectWatcher extends EventEmitter {
  private readonly debounceMs: number;
  private fsWatcher: FSWatcher | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly projectRoot: string,
    options: ProjectWatcherOptions = {},
  ) {
    super();
    this.debounceMs = options.debounceMs ?? 2000;
  }

  async start(): Promise<void> {
    if (this.fsWatcher) return; // already running

    this.fsWatcher = chokidar.watch(this.projectRoot, {
      persistent: true,
      ignoreInitial: true,
      ignored: [
        /node_modules/,
        /[/\\]\./,           // dotfiles/dotdirs (except our config files — handled below)
        /dist[/\\]/,
        /__pycache__/,
        /\.git[/\\]/,
        /target[/\\]/,       // Rust build output
        /vendor[/\\]/,
      ],
      followSymlinks: false,
      depth: 8,
    });

    const handler = (fsEvent: ChangeEvent['fsEvent']) => (filePath: string) => {
      const category = classifyPath(filePath, fsEvent);
      if (!category) return;
      this.scheduleEmit({ category, path: filePath, fsEvent, timestamp: new Date() });
    };

    this.fsWatcher
      .on('add',    handler('add'))
      .on('change', handler('change'))
      .on('unlink', handler('unlink'))
      .on('addDir', handler('addDir'));

    // Wait for chokidar's ready event before resolving
    await new Promise<void>((resolve) => {
      this.fsWatcher!.on('ready', resolve);
    });
  }

  async stop(): Promise<void> {
    // Cancel all pending debounce timers
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();

    if (this.fsWatcher) {
      await this.fsWatcher.close();
      this.fsWatcher = null;
    }
  }

  private scheduleEmit(event: ChangeEvent): void {
    const key = event.path;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      // Refresh the timestamp to when the debounce window expired
      this.emit('change', { ...event, timestamp: new Date() } satisfies ChangeEvent);
    }, this.debounceMs);

    this.debounceTimers.set(key, timer);
  }
}
