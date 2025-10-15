#!/usr/bin/env ts-node

/**
 * analyze-ts-imports.ts
 * TypeScriptファイルのimport文を解析
 *
 * Usage: npx ts-node src/analyze-ts-imports.ts <ts-file>
 */

import * as fs from 'fs';
import { parse } from '@typescript-eslint/typescript-estree';

interface ImportInfo {
  source: string;
  importType: 'named' | 'default' | 'namespace' | 'side-effect';
  imports: string[];
  line: number;
}

function analyzeImports(filePath: string): ImportInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports: ImportInfo[] = [];

  try {
    const ast = parse(content, {
      loc: true,
      range: true,
      comment: false
    });

    ast.body.forEach((node: any) => {
      if (node.type === 'ImportDeclaration') {
        const source = node.source.value;
        const line = node.loc.start.line;
        const importedItems: string[] = [];
        let importType: ImportInfo['importType'] = 'side-effect';

        if (node.specifiers && node.specifiers.length > 0) {
          node.specifiers.forEach((spec: any) => {
            if (spec.type === 'ImportDefaultSpecifier') {
              importType = 'default';
              importedItems.push(spec.local.name);
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              importType = 'namespace';
              importedItems.push(`* as ${spec.local.name}`);
            } else if (spec.type === 'ImportSpecifier') {
              importType = 'named';
              if (spec.imported.name === spec.local.name) {
                importedItems.push(spec.local.name);
              } else {
                importedItems.push(`${spec.imported.name} as ${spec.local.name}`);
              }
            }
          });
        }

        imports.push({
          source,
          importType,
          imports: importedItems,
          line
        });
      }
    });
  } catch (error) {
    console.error('Error parsing TypeScript file:', error);
  }

  return imports;
}

function categorizeImports(imports: ImportInfo[]): {
  angular: ImportInfo[];
  thirdParty: ImportInfo[];
  relative: ImportInfo[];
} {
  const angular = imports.filter(i => i.source.startsWith('@angular/'));
  const relative = imports.filter(i => i.source.startsWith('.') || i.source.startsWith('/'));
  const thirdParty = imports.filter(i => !i.source.startsWith('@angular/') && !i.source.startsWith('.') && !i.source.startsWith('/'));

  return { angular, thirdParty, relative };
}

function displayImports(imports: ImportInfo[]): void {
  if (imports.length === 0) {
    console.log('No imports found.');
    return;
  }

  console.log('\n=== Imports ===\n');

  imports.forEach((imp, index) => {
    console.log(`[${index + 1}] Line ${imp.line}: ${imp.importType} import`);
    console.log(`    Source: ${imp.source}`);
    if (imp.imports.length > 0) {
      console.log(`    Imports: ${imp.imports.join(', ')}`);
    }
    console.log('');
  });
}

function main(): void {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: TypeScript file not specified');
    console.error('Usage: npx ts-node src/analyze-ts-imports.ts <ts-file>');
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

    const imports = analyzeImports(filePath);
    const categorized = categorizeImports(imports);

    // カテゴリごとに表示
    if (categorized.angular.length > 0) {
      console.log('\n--- Angular Imports ---');
      displayImports(categorized.angular);
    }

    if (categorized.thirdParty.length > 0) {
      console.log('\n--- Third Party Imports ---');
      displayImports(categorized.thirdParty);
    }

    if (categorized.relative.length > 0) {
      console.log('\n--- Relative Imports ---');
      displayImports(categorized.relative);
    }

    // 統計情報
    console.log('\n=== Statistics ===');
    console.log(`Total imports: ${imports.length}`);
    console.log(`Angular imports: ${categorized.angular.length}`);
    console.log(`Third-party imports: ${categorized.thirdParty.length}`);
    console.log(`Relative imports: ${categorized.relative.length}`);

    // JSON出力
    console.log('\n=== JSON Output ===');
    console.log(JSON.stringify(imports, null, 2));
  } catch (error) {
    console.error('Error analyzing TypeScript file:', error);
    process.exit(1);
  }
}

main();
