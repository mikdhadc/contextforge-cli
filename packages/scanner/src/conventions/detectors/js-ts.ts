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

function hasChildType(node: SyntaxNode, type: string): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child?.type === type) return true;
  }
  return false;
}

interface FileAnalysis {
  functionNames: string[];
  classNames: string[];
  variableNames: string[];
  constantNames: string[];
  importStyles: string[];
  exportStyles: string[];
  testPatterns: string[];
  testFrameworks: string[];
}

function analyzeTree(root: SyntaxNode, filePath: string): FileAnalysis {
  const result: FileAnalysis = {
    functionNames: [],
    classNames: [],
    variableNames: [],
    constantNames: [],
    importStyles: [],
    exportStyles: [],
    testPatterns: [],
    testFrameworks: [],
  };

  for (const node of walkTree(root)) {
    switch (node.type) {
      case 'function_declaration': {
        const name = getChildText(node, 'identifier');
        if (name) result.functionNames.push(name);
        break;
      }
      case 'method_definition': {
        const name = getChildText(node, 'property_identifier');
        if (name) result.functionNames.push(name);
        break;
      }
      case 'variable_declarator': {
        const nameNode = node.child(0);
        const initNode = node.child(2); // after '='
        if (!nameNode || nameNode?.type !== 'identifier') break;
        const varName = nameNode.text;
        if (!varName || varName.length <= 1) break;

        // If init is a function or arrow, treat as function name
        if (initNode && (initNode.type === 'function' || initNode.type === 'arrow_function')) {
          result.functionNames.push(varName);
          break;
        }

        // Check if ALL_CAPS constant
        if (/^[A-Z][A-Z0-9_]+$/.test(varName)) {
          result.constantNames.push(varName);
          break;
        }

        result.variableNames.push(varName);
        break;
      }
      case 'class_declaration': {
        const name = getChildText(node, 'identifier');
        if (name) result.classNames.push(name);
        break;
      }
      case 'import_statement': {
        // The import clause is nested: import_statement > import_clause > {named_imports|namespace_import|identifier}
        let clause: SyntaxNode | null = null;
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child?.type === 'import_clause') { clause = child; break; }
        }
        if (clause) {
          if (hasChildType(clause, 'named_imports')) {
            result.importStyles.push('named');
          } else if (hasChildType(clause, 'namespace_import')) {
            result.importStyles.push('namespace');
          } else if (hasChildType(clause, 'identifier')) {
            result.importStyles.push('default');
          }
        }
        // Check for test framework imports
        const fromSource = getImportSource(node);
        if (fromSource) {
          if (fromSource.includes('vitest')) result.testFrameworks.push('vitest');
          else if (fromSource.includes('jest')) result.testFrameworks.push('jest');
          else if (fromSource.includes('@testing-library')) result.testFrameworks.push('testing-library');
        }
        break;
      }
      case 'call_expression': {
        const callee = node.child(0);
        if (callee?.text === 'require') {
          result.importStyles.push('require');
        }
        break;
      }
      case 'export_statement': {
        let hasFrom = false;
        let hasStar = false;
        let hasDefault = false;
        let hasExportClause = false;

        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (!child) continue;
          if (child.type === 'export_clause') hasExportClause = true;
          if (child.type === 'namespace_export') hasStar = true;
          if (child.text === 'default') hasDefault = true;
          if (child.text === 'from') hasFrom = true;
          if (child.text === '*') hasStar = true;
        }

        if (hasStar && hasFrom) {
          result.exportStyles.push('barrel');
        } else if (hasExportClause && hasFrom) {
          result.exportStyles.push('reexport');
        } else if (hasDefault) {
          result.exportStyles.push('default');
        } else if (hasExportClause) {
          result.exportStyles.push('named');
        } else {
          result.exportStyles.push('named');
        }
        break;
      }
    }
  }

  return result;
}

function getImportSource(node: SyntaxNode): string | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child?.type === 'string') {
      return child.text.replace(/['"]/g, '');
    }
  }
  return null;
}

export async function detectJsTsConventions(
  ctx: LanguageContext,
  files: string[],
): Promise<ConventionSet> {
  const parser = await createParser('tree-sitter-javascript', 'tree-sitter-javascript.wasm');

  const funcAcc = new PatternAccumulator();
  const classAcc = new PatternAccumulator();
  const varAcc = new PatternAccumulator();
  const constAcc = new PatternAccumulator();
  const importAcc = new PatternAccumulator();
  const exportAcc = new PatternAccumulator();
  const testPatternAcc = new PatternAccumulator();
  const testFrameworks = new Set<string>();

  for (const file of files) {
    const relPath = path.relative(ctx.root, file);
    const fileName = path.basename(file);

    // Test file pattern detection based on filename (no parser needed)
    if (fileName.includes('.test.')) testPatternAcc.add('.test', relPath);
    else if (fileName.includes('.spec.')) testPatternAcc.add('.spec', relPath);
    else if (file.includes('__tests__')) testPatternAcc.add('__tests__', relPath);

    let source: string;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    let analysis: FileAnalysis;
    if (parser) {
      try {
        const tree = parser.parse(source);
        if (tree) {
          analysis = analyzeTree(tree.rootNode, file);
          tree.delete();
        } else {
          continue;
        }
      } catch {
        continue;
      }
    } else {
      continue;
    }

    for (const name of analysis.functionNames) {
      funcAcc.add(detectNamingPattern(name), relPath);
    }
    for (const name of analysis.classNames) {
      classAcc.add(detectNamingPattern(name), relPath);
    }
    for (const name of analysis.variableNames) {
      varAcc.add(detectNamingPattern(name), relPath);
    }
    for (const name of analysis.constantNames) {
      constAcc.add(detectNamingPattern(name), relPath);
    }
    for (const style of analysis.importStyles) {
      importAcc.add(style, relPath);
    }
    for (const style of analysis.exportStyles) {
      exportAcc.add(style, relPath);
    }
    for (const fw of analysis.testFrameworks) {
      testFrameworks.add(fw);
    }
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
    exports: {
      dominant: exportAcc.toOccurrence(),
    },
    tests: {
      filePattern: testPatternAcc.toOccurrence(),
      framework: testFrameworks.size > 0 ? Array.from(testFrameworks).join(', ') : null,
    },
    folderStructure,
  };
}
