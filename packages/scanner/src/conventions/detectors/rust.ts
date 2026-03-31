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

export async function detectRustConventions(
  ctx: LanguageContext,
  files: string[],
): Promise<ConventionSet> {
  const parser = await createParser('tree-sitter-rust', 'tree-sitter-rust.wasm');

  const funcAcc = new PatternAccumulator();
  const typeAcc = new PatternAccumulator();
  const importAcc = new PatternAccumulator();
  const testPatternAcc = new PatternAccumulator();

  for (const file of files) {
    const relPath = path.relative(ctx.root, file);

    // Check if file is in tests/ directory (integration tests)
    if (file.includes(`${path.sep}tests${path.sep}`)) {
      testPatternAcc.add('integration tests', relPath);
    }

    let source: string;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    // Check for inline test modules
    if (source.includes('#[cfg(test)]')) {
      testPatternAcc.add('inline tests', relPath);
    }

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
        case 'function_item': {
          const name = getChildText(node, 'identifier');
          if (name) funcAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        
        case 'struct_item':
        case 'enum_item': {
          const name = getChildText(node, 'type_identifier');
          if (name) typeAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        case 'use_declaration': {
          importAcc.add('use', relPath);
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
      framework: null,
    },
    folderStructure,
  };
}
