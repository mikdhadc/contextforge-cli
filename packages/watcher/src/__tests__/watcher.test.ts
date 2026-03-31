import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProjectWatcher } from '../watcher.js';
import type { ChangeEvent } from '../types.js';

/** Creates a temp dir, returns its path */
function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cf-watcher-test-'));
}

/** Waits up to `ms` for `predicate` to return true, polling every 50ms */
async function waitFor(predicate: () => boolean, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('waitFor timed out');
}

describe('ProjectWatcher integration', () => {
  let tmpDir: string;
  let watcher: ProjectWatcher;

  beforeEach(() => {
    tmpDir = makeTmp();
  });

  afterEach(async () => {
    await watcher?.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('emits a change event for package.json modification', async () => {
    // Use a very short debounce so the test is fast
    watcher = new ProjectWatcher(tmpDir, { debounceMs: 100 });

    const events: ChangeEvent[] = [];
    watcher.on('change', (e: ChangeEvent) => events.push(e));

    await watcher.start();
    // Give watcher time to initialize and attach fs listeners
    await new Promise(r => setTimeout(r, 100));

    // Write package.json into the watched dir
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}', 'utf8');

    await waitFor(() => events.length > 0, 5000);

    expect(events[0].category).toBe('dependency-manifest');
    expect(events[0].path).toContain('package.json');
    expect(events[0].fsEvent).toBe('add');
  });

  it('emits change for go.mod creation', async () => {
    watcher = new ProjectWatcher(tmpDir, { debounceMs: 100 });
    const events: ChangeEvent[] = [];
    watcher.on('change', (e: ChangeEvent) => events.push(e));
    await watcher.start();
    await new Promise(r => setTimeout(r,100));

    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/app\n\ngo 1.21\n');

    await waitFor(() => events.length > 0, 5000);
    expect(events[0].category).toBe('dependency-manifest');
  });

  it('emits change for tsconfig.json modification', async () => {
    // Pre-create the file so watcher sees a change, not an add
    const configPath = path.join(tmpDir, 'tsconfig.json');
    fs.writeFileSync(configPath, '{}');

    watcher = new ProjectWatcher(tmpDir, { debounceMs: 100 });
    const events: ChangeEvent[] = [];
    watcher.on('change', (e: ChangeEvent) => events.push(e));
    await watcher.start();
    await new Promise(r => setTimeout(r, 100));

    fs.writeFileSync(configPath, '{"strict":true}');

    await waitFor(() => events.length > 0, 5000);
    expect(events[0].category).toBe('config');
    expect(events[0].fsEvent).toBe('change');
  });

  it('emits change for .sql schema file', async () => {
    const dbDir = path.join(tmpDir, 'db');
    fs.mkdirSync(dbDir);

    watcher = new ProjectWatcher(tmpDir, { debounceMs: 100 });
    const events: ChangeEvent[] = [];
    watcher.on('change', (e: ChangeEvent) => events.push(e));
    await watcher.start();
    await new Promise(r => setTimeout(r, 100));

    fs.writeFileSync(path.join(dbDir, 'schema.sql'), 'CREATE TABLE users (id INT);');

    await waitFor(() => events.length > 0, 5000);
    expect(events[0].category).toBe('schema');
  });

  it('emits new-directory for a new dir created under src/', async () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);

    watcher = new ProjectWatcher(tmpDir, { debounceMs: 100 });
    const events: ChangeEvent[] = [];
    watcher.on('change', (e: ChangeEvent) => events.push(e));
    await watcher.start();
    await new Promise(r => setTimeout(r, 100));

    fs.mkdirSync(path.join(srcDir, 'features'));

    await waitFor(() => events.length > 0, 5000);
    expect(events[0].category).toBe('new-directory');
  });

  it('debounces rapid successive changes into one event', async () => {
    watcher = new ProjectWatcher(tmpDir, { debounceMs: 200 });
    const events: ChangeEvent[] = [];
    watcher.on('change', (e: ChangeEvent) => events.push(e));
    await watcher.start();
    await new Promise(r => setTimeout(r, 100));

    const pkgPath = path.join(tmpDir, 'package.json');
    // Write the file three times rapidly
    fs.writeFileSync(pkgPath, '{"name":"v1"}');
    fs.writeFileSync(pkgPath, '{"name":"v2"}');
    fs.writeFileSync(pkgPath, '{"name":"v3"}');

    // Wait for debounce to expire
    await new Promise(r => setTimeout(r, 400));

    // Should receive at most 1 event for the same path
    const pkgEvents = events.filter(e => e.path.endsWith('package.json'));
    expect(pkgEvents.length).toBe(1);
  });

  it('does not emit for arbitrary source file changes', async () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);

    watcher = new ProjectWatcher(tmpDir, { debounceMs: 100 });
    const events: ChangeEvent[] = [];
    watcher.on('change', (e: ChangeEvent) => events.push(e));
    await watcher.start();
    await new Promise(r => setTimeout(r, 100));

    // Write a plain .ts file — should not trigger an event
    fs.writeFileSync(path.join(srcDir, 'utils.ts'), 'export const x = 1;');

    // Wait longer than debounce to confirm no event
    await new Promise(r => setTimeout(r, 300));
    expect(events).toHaveLength(0);
  });

  it('does not emit for changes inside node_modules', async () => {
    const nmDir = path.join(tmpDir, 'node_modules', 'some-pkg');
    fs.mkdirSync(nmDir, { recursive: true });

    watcher = new ProjectWatcher(tmpDir, { debounceMs: 100 });
    const events: ChangeEvent[] = [];
    watcher.on('change', (e: ChangeEvent) => events.push(e));
    await watcher.start();
    await new Promise(r => setTimeout(r, 100));

    fs.writeFileSync(path.join(nmDir, 'package.json'), '{}');

    await new Promise(r => setTimeout(r, 300));
    expect(events).toHaveLength(0);
  });

  it('stop() cancels pending debounce timers', async () => {
    watcher = new ProjectWatcher(tmpDir, { debounceMs: 500 });
    const events: ChangeEvent[] = [];
    watcher.on('change', (e: ChangeEvent) => events.push(e));
    await watcher.start();
    await new Promise(r => setTimeout(r, 100));

    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    // Stop immediately before debounce fires
    await watcher.stop();
    await new Promise(r => setTimeout(r, 600));

    expect(events).toHaveLength(0);
  });
});
