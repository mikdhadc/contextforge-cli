import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Node as SyntaxNode } from 'web-tree-sitter';
import type { LanguageContext } from '../../types.js';
import type { ConventionSet } from '../types.js';
import { detectNamingPattern, PatternAccumulator } from '../naming.js';
import { createParser } from '../parser-pool.js';
import { detectFolderStructure } from '../walk.js';

function* walkTree(node: SyntaxNode): Generator<SyntaxNode> {
  yield node;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) yield* walkTree(child);
  }
}

function getChildText(node: SyntaxNode, type: string): string | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child?.type === type) return child.text;
  }
  return null;
}

export async function detectGoConventions(
  ctx: LanguageContext,
  files: string[],
): Promise<ConventionSet> {
  const parser = await createParser('tree-sitter-go', 'tree-sitter-go.wasm');

  const funcAcc = new PatternAccumulator();
  const typeAcc = new PatternAccumulator();
  const importAcc = new PatternAccumulator();
  const testPatternAcc = new PatternAccumulator();

  for (const file of files) {
    const fileName = path.basename(file);
    const relPath = path.relative(ctx.root, file);

    // Test file detection
    if (fileName.endsWith('_test.go')) {
      testPatternAcc.add('_test.go', relPath);
    }

    let source: string;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    // Skip test files for naming analysis
    const isTestFile = fileName.endsWith('_test.go');

    if (!parser) continue;

    let tree: import('web-tree-sitter').Tree | null = null;
    try {
      tree = parser.parse(source);
      if (!tree) continue;
    } catch {
      continue;
    }

    for (const node of walkTree(tree.rootNode)) {
      switch (node.type) {
        case 'function_declaration': {
          if (!isTestFile) {
            const name = getChildText(node, 'identifier');
            if (name) funcAcc.add(detectNamingPattern(name), relPath);
          }
          break;
        }
        case 'type_spec': {
          const name = getChildText(node, 'type_identifier');
          if (name) typeAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        case 'import_spec': {
          // Check for alias
          let hasAlias = false;
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child?.type === 'dot' || (child?.type === 'package_identifier' && i === 0)) {
              hasAlias = true;
              break;
            }
          }
          importAcc.add(hasAlias ? 'aliased' : 'single', relPath);
          break;
        }
        case 'import_declaration': {
          // Check if grouped (has import_spec_list)
          let isGrouped = false;
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child?.type === 'import_spec_list') { isGrouped = true; break; }
          }
          if (isGrouped) importAcc.add('grouped', relPath);
          break;
        }
      }
    }

    // Check for testing.T usage
    if (source.includes('testing.T')) {
      testPatternAcc.add('go-testing', relPath);
    }

    tree.delete();
  }

  const folderStructure = detectFolderStructure(ctx.root);

  return {
    naming: {
      functions: funcAcc.toOccurrence(),
      classes: typeAcc.toOccurrence(),
      variables: null,
      constants: null,
    },
    imports: {
      dominant: importAcc.toOccurrence(),
    },
    exports: null,
    tests: {
      filePattern: testPatternAcc.toOccurrence(),
      framework: 'go-testing',
    },
    folderStructure,
  };
}
