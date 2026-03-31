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

export async function detectRubyConventions(
  ctx: LanguageContext,
  files: string[],
): Promise<ConventionSet> {
  const parser = await createParser('tree-sitter-ruby', 'tree-sitter-ruby.wasm');

  const methodAcc = new PatternAccumulator();
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
        case 'method': {
          const name = getChildText(node, 'identifier');
          if (name) methodAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        case 'class': {
          const name = getChildText(node, 'constant');
          if (name) classAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        case 'call': {
          // require / require_relative
          const method = getChildText(node, 'identifier');
          if (method === 'require') {
            importAcc.add('require', relPath);
          } else if (method === 'require_relative') {
            importAcc.add('require_relative', relPath);
          }
          break;
        }
      }
    }

    tree.delete();
  }

  const folderStructure = detectFolderStructure(ctx.root);

  return {
    naming: {
      functions: methodAcc.toOccurrence(),
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
