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

export async function detectPythonConventions(
  ctx: LanguageContext,
  files: string[],
): Promise<ConventionSet> {
  const parser = await createParser('tree-sitter-python', 'tree-sitter-python.wasm');

  const funcAcc = new PatternAccumulator();
  const classAcc = new PatternAccumulator();
  const importAcc = new PatternAccumulator();
  const testPatternAcc = new PatternAccumulator();
  const testFrameworks = new Set<string>();

  for (const file of files) {
    let source: string;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const fileName = path.basename(file);
    const relPath = path.relative(ctx.root, file);

    // Test file pattern detection
    if (fileName.startsWith('test_')) testPatternAcc.add('test_ prefix', relPath);
    else if (fileName.endsWith('_test.py')) testPatternAcc.add('_test suffix', relPath);

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
        case 'function_definition': {
          const name = getChildText(node, 'identifier');
          if (name) funcAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        case 'class_definition': {
          const name = getChildText(node, 'identifier');
          if (name) classAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        case 'import_statement': {
          // Check for wildcard
          let isWildcard = false;
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child?.type === 'wildcard_import') { isWildcard = true; break; }
          }
          importAcc.add(isWildcard ? 'wildcard' : 'direct', relPath);

          // Test framework detection
          const text = node.text;
          if (text.includes('pytest')) testFrameworks.add('pytest');
          if (text.includes('unittest')) testFrameworks.add('unittest');
          break;
        }
        case 'import_from_statement': {
          let isWildcard = false;
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child?.type === 'wildcard_import') { isWildcard = true; break; }
          }
          importAcc.add(isWildcard ? 'wildcard' : 'from', relPath);

          const text = node.text;
          if (text.includes('pytest')) testFrameworks.add('pytest');
          if (text.includes('unittest')) testFrameworks.add('unittest');
          break;
        }
      }
    }

    tree.delete();
  }

  const folderStructure = detectFolderStructure(ctx.root);

  return {
    naming: {
      functions: funcAcc.toOccurrence(),
      classes: classAcc.toOccurrence(),
      variables: null,
      constants: null,
    },
    imports: {
      dominant: importAcc.toOccurrence(),
    },
    exports: null,
    tests: {
      filePattern: testPatternAcc.toOccurrence(),
      framework: testFrameworks.size > 0 ? Array.from(testFrameworks).join(', ') : null,
    },
    folderStructure,
  };
}
