#!/usr/bin/env node
import { startServer } from './server.js';

startServer().catch((err) => {
  process.stderr.write(`contextforge-mcp fatal error: ${err}\n`);
  process.exit(1);
});
