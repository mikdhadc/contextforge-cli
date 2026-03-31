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

export async function detectPhpConventions(
  ctx: LanguageContext,
  files: string[],
): Promise<ConventionSet> {
  const parser = await createParser('tree-sitter-php', 'tree-sitter-php.wasm');

  const funcAcc = new PatternAccumulator();
  const classAcc = new PatternAccumulator();
  const importAcc = new PatternAccumulator();

  for (const file of files) {
    let source: string;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = path.relative(ctx.root, file);

    // Regex-based fallback for require/include (works without parser too)
    if (/\brequire_once\b|\binclude\b|\brequire\b|\binclude_once\b/.test(source)) {
      importAcc.add('require/include', relPath);
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
        case 'function_definition': {
          const name = getChildText(node, 'name');
          if (name) funcAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        case 'class_declaration': {
          const name = getChildText(node, 'name');
          if (name) classAcc.add(detectNamingPattern(name), relPath);
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
      classes: classAcc.toOccurrence(),
      variables: null,
      constants: null,
    },
    imports: {
      dominant: importAcc.toOccurrence(),
    },
    exports: null,
    tests: {
      filePattern: null,
      framework: null,
    },
    folderStructure,
  };
}
