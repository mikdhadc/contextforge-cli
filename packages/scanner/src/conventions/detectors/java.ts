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

export async function detectJavaConventions(
  ctx: LanguageContext,
  files: string[],
): Promise<ConventionSet> {
  const parser = await createParser('tree-sitter-java', 'tree-sitter-java.wasm');

  const funcAcc = new PatternAccumulator();
  const classAcc = new PatternAccumulator();
  const varAcc = new PatternAccumulator();
  const constAcc = new PatternAccumulator();
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
    if (fileName.endsWith('Test.java')) testPatternAcc.add('Test suffix', relPath);
    else if (fileName.endsWith('Tests.java')) testPatternAcc.add('Tests suffix', relPath);
    else if (fileName.startsWith('Test')) testPatternAcc.add('Test prefix', relPath);

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
        case 'method_declaration': {
          const name = getChildText(node, 'identifier');
          if (name) funcAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        case 'class_declaration':
        case 'interface_declaration':
        case 'enum_declaration': {
          const name = getChildText(node, 'identifier');
          if (name) classAcc.add(detectNamingPattern(name), relPath);
          break;
        }
        case 'field_declaration': {
          // Check if it's a constant (static final)
          let isConstant = false;
          let isStatic = false;
          let isFinal = false;
          
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child?.type === 'modifiers') {
              const modText = child.text;
              if (modText.includes('static')) isStatic = true;
              if (modText.includes('final')) isFinal = true;
            }
          }
          isConstant = isStatic && isFinal;

          // Get variable declarator
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child?.type === 'variable_declarator') {
              const name = getChildText(child, 'identifier');
              if (name) {
                if (isConstant) {
                  constAcc.add(detectNamingPattern(name), relPath);
                } else {
                  varAcc.add(detectNamingPattern(name), relPath);
                }
              }
            }
          }
          break;
        }
        case 'local_variable_declaration': {
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child?.type === 'variable_declarator') {
              const name = getChildText(child, 'identifier');
              if (name) varAcc.add(detectNamingPattern(name), relPath);
            }
          }
          break;
        }
        case 'import_declaration': {
          const text = node.text;
          // Check for wildcard imports
          if (text.includes('*')) {
            importAcc.add('wildcard', relPath);
          } else if (text.includes('static')) {
            importAcc.add('static', relPath);
          } else {
            importAcc.add('explicit', relPath);
          }

          // Test framework detection
          if (text.includes('org.junit')) testFrameworks.add('JUnit');
          if (text.includes('org.testng')) testFrameworks.add('TestNG');
          if (text.includes('org.mockito')) testFrameworks.add('Mockito');
          if (text.includes('org.springframework.test')) testFrameworks.add('Spring Test');
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
      variables: varAcc.toOccurrence(),
      constants: constAcc.toOccurrence(),
    },
    imports: {
      dominant: importAcc.toOccurrence(),
    },
    exports: null, // Java doesn't have exports like JS/TS
    tests: {
      filePattern: testPatternAcc.toOccurrence(),
      framework: testFrameworks.size > 0 ? Array.from(testFrameworks).join(', ') : null,
    },
    folderStructure,
  };
}

