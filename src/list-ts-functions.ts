#!/usr/bin/env ts-node

/**
 * list-ts-functions.ts
 * TypeScriptファイルの関数/メソッドを一覧化
 *
 * Usage: npx ts-node src/list-ts-functions.ts <ts-file>
 */

import * as fs from 'fs';
import { parse } from '@typescript-eslint/typescript-estree';

interface FunctionInfo {
  name: string;
  type: 'function' | 'method' | 'arrow' | 'constructor';
  parameters: string[];
  returnType: string;
  line: number;
  isAsync: boolean;
  isStatic: boolean;
  accessibility?: 'public' | 'private' | 'protected';
}

function extractFunctions(filePath: string): FunctionInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const functions: FunctionInfo[] = [];

  try {
    const ast = parse(content, {
      loc: true,
      range: true,
      comment: false
    });

    function traverse(node: any): void {
      if (!node) return;

      // Function Declaration
      if (node.type === 'FunctionDeclaration' && node.id) {
        const params = node.params.map((p: any) => {
          if (p.type === 'Identifier') {
            return p.name + (p.typeAnnotation ? `: ${getTypeAnnotation(p.typeAnnotation)}` : '');
          }
          return 'param';
        });

        functions.push({
          name: node.id.name,
          type: 'function',
          parameters: params,
          returnType: node.returnType ? getTypeAnnotation(node.returnType) : 'void',
          line: node.loc.start.line,
          isAsync: node.async || false,
          isStatic: false
        });
      }

      // Method Definition (class methods)
      if (node.type === 'MethodDefinition') {
        const params = node.value.params.map((p: any) => {
          if (p.type === 'Identifier') {
            return p.name + (p.typeAnnotation ? `: ${getTypeAnnotation(p.typeAnnotation)}` : '');
          }
          return 'param';
        });

        const name = node.key.type === 'Identifier' ? node.key.name : 'unknown';

        functions.push({
          name,
          type: node.kind === 'constructor' ? 'constructor' : 'method',
          parameters: params,
          returnType: node.value.returnType ? getTypeAnnotation(node.value.returnType) : 'void',
          line: node.loc.start.line,
          isAsync: node.value.async || false,
          isStatic: node.static || false,
          accessibility: node.accessibility
        });
      }

      // Arrow Function (as property)
      if (node.type === 'VariableDeclarator' && node.init && node.init.type === 'ArrowFunctionExpression') {
        const params = node.init.params.map((p: any) => {
          if (p.type === 'Identifier') {
            return p.name + (p.typeAnnotation ? `: ${getTypeAnnotation(p.typeAnnotation)}` : '');
          }
          return 'param';
        });

        functions.push({
          name: node.id.name,
          type: 'arrow',
          parameters: params,
          returnType: node.init.returnType ? getTypeAnnotation(node.init.returnType) : 'inferred',
          line: node.loc.start.line,
          isAsync: node.init.async || false,
          isStatic: false
        });
      }

      // Traverse children
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach((child: any) => traverse(child));
          } else {
            traverse(node[key]);
          }
        }
      }
    }

    function getTypeAnnotation(typeNode: any): string {
      if (!typeNode) return 'any';
      if (typeNode.type === 'TSTypeAnnotation') {
        return getTypeAnnotation(typeNode.typeAnnotation);
      }
      if (typeNode.type === 'TSStringKeyword') return 'string';
      if (typeNode.type === 'TSNumberKeyword') return 'number';
      if (typeNode.type === 'TSBooleanKeyword') return 'boolean';
      if (typeNode.type === 'TSVoidKeyword') return 'void';
      if (typeNode.type === 'TSAnyKeyword') return 'any';
      if (typeNode.type === 'TSTypeReference' && typeNode.typeName) {
        return typeNode.typeName.name || 'unknown';
      }
      return 'unknown';
    }

    traverse(ast);
  } catch (error) {
    console.error('Error parsing TypeScript file:', error);
  }

  return functions;
}

function displayTable(functions: FunctionInfo[]): void {
  if (functions.length === 0) {
    console.log('No functions found.');
    return;
  }

  console.log('\n=== Functions/Methods ===\n');
  console.log('┌──────┬──────────┬────────────────────────┬────────────────────────────────┬──────────────┐');
  console.log('│ Line │ Type     │ Name                   │ Parameters                     │ Return Type  │');
  console.log('├──────┼──────────┼────────────────────────┼────────────────────────────────┼──────────────┤');

  functions.forEach(func => {
    const line = func.line.toString().padEnd(5);
    let type = func.type.padEnd(8);
    if (func.isAsync) type = 'async ' + func.type.substring(0, 3);
    if (func.isStatic) type = 'static';
    type = type.padEnd(8);

    const accessibility = func.accessibility ? `${func.accessibility} ` : '';
    const name = (accessibility + func.name).substring(0, 22).padEnd(22);
    const params = func.parameters.join(', ').substring(0, 30).padEnd(30);
    const returnType = func.returnType.substring(0, 12).padEnd(12);

    console.log(`│ ${line}│ ${type}│ ${name} │ ${params} │ ${returnType} │`);
  });

  console.log('└──────┴──────────┴────────────────────────┴────────────────────────────────┴──────────────┘');
}

function main(): void {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: TypeScript file not specified');
    console.error('Usage: npx ts-node src/list-ts-functions.ts <ts-file>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File "${filePath}" does not exist`);
    process.exit(1);
  }

  if (!filePath.endsWith('.ts')) {
    console.error(`Error: "${filePath}" is not a TypeScript file`);
    process.exit(1);
  }

  try {
    console.log(`\n=== Analyzing: ${filePath} ===`);

    const functions = extractFunctions(filePath);
    displayTable(functions);

    // 統計情報
    const methods = functions.filter(f => f.type === 'method');
    const regularFunctions = functions.filter(f => f.type === 'function');
    const arrowFunctions = functions.filter(f => f.type === 'arrow');
    const asyncFunctions = functions.filter(f => f.isAsync);

    console.log(`\n=== Statistics ===`);
    console.log(`Total functions: ${functions.length}`);
    console.log(`Methods: ${methods.length}`);
    console.log(`Functions: ${regularFunctions.length}`);
    console.log(`Arrow functions: ${arrowFunctions.length}`);
    console.log(`Async functions: ${asyncFunctions.length}`);

    // JSON出力
    console.log('\n=== JSON Output ===');
    console.log(JSON.stringify(functions, null, 2));
  } catch (error) {
    console.error('Error analyzing TypeScript file:', error);
    process.exit(1);
  }
}

main();
