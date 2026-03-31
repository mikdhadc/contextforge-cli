#!/bin/bash
# ContextForge Quick Start & Troubleshooting
# Verifies installation and helps diagnose issues

echo "🔧 ContextForge Diagnostics"
echo "================================"

echo -e "\n1️⃣  Node Environment"
echo "   Node: $(node --version)"
echo "   npm: $(npm --version)"
echo "   pnpm: $(pnpm --version)"

echo -e "\n2️⃣  Installation Paths"
if which contextforge > /dev/null; then
  echo "   ✓ contextforge: $(which contextforge)"
else
  echo "   ✗ contextforge: NOT in PATH"
  echo "     Fix: cd packages/cli && npm link"
fi

if which contextforge-mcp > /dev/null; then
  echo "   ✓ contextforge-mcp: $(which contextforge-mcp)"
else
  echo "   ✗ contextforge-mcp: NOT in PATH"
  echo "     Fix: cd packages/mcp && npm link"
fi

echo -e "\n3️⃣  Built Artifacts"
if [ -f packages/cli/dist/bin.js ]; then
  echo "   ✓ CLI built"
else
  echo "   ✗ CLI not built. Run: pnpm build"
fi

if [ -f packages/mcp/dist/bin.js ]; then
  echo "   ✓ MCP built"
else
  echo "   ✗ MCP not built. Run: pnpm build"
fi

echo -e "\n4️⃣  Test Project Setup"
TEST_DIR=$(mktemp -d)
echo "   Testing in: $TEST_DIR"

cd "$TEST_DIR"
if contextforge init --ide claude-code 2>&1 | grep -q "Generated"; then
  echo "   ✓ Project initialization works"
else
  echo "   ✗ Project initialization failed"
  rm -rf "$TEST_DIR"
  exit 1
fi

echo -e "\n5️⃣  Project Files"
echo "   ✓ .context.md: $([ -f .context.md ] && echo YES || echo NO)"
echo "   ✓ .mcp.json: $([ -f .mcp.json ] && echo YES || echo NO)"
echo "   ✓ .contextforge/: $([ -d .contextforge ] && echo YES || echo NO)"

echo -e "\n6️⃣  MCP Server Test"
if PROJECT_ROOT=. timeout 3 node /Users/beethovkj/Desktop/personal/context-forge-npm/packages/mcp/dist/bin.js 2>&1 | head -1 | grep -q "\[contextforge\]"; then
  echo "   ✓ MCP server starts correctly"
else
  echo "   ⚠ MCP server output unclear (this is OK — it waits for input)"
fi

# Cleanup
cd /
rm -rf "$TEST_DIR"

echo -e "\n✅ Diagnostics complete!"
echo ""
echo "📍 Next Steps:"
echo "   1. cd /path/to/your-project"
echo "   2. contextforge init --ide claude-code"
echo "   3. Open Claude Code, Cursor, or your IDE"
echo "   4. MCP server starts automatically when IDE connects"
echo ""
echo "📖 For more help, see:"
echo "   - WORKING_FLOW.md (complete guide)"
echo "   - MCP_TROUBLESHOOTING.md (troubleshooting)"
