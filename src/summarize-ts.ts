#!/usr/bin/env ts-node

/**
 * summarize-ts.ts
 * TypeScriptファイルをMarkdownサマリ化
 *
 * Usage: npx ts-node src/summarize-ts.ts <ts-file>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';

interface TsSummary {
  fileName: string;
  role: string;
  decorators: string[];
  imports: {
    angular: string[];
    thirdParty: string[];
    relative: string[];
  };
  exports: Array<{
    name: string;
    type: 'class' | 'function' | 'variable' | 'interface' | 'type' | 'enum';
  }>;
  classes: Array<{
    name: string;
    implements: string[];
    extends?: string;
  }>;
  functions: Array<{
    name: string;
    type: string;
    parameters: number;
  }>;
  interfaces: string[];
  types: string[];
  enums: string[];
  lineCount: number;
}

function analyzeTs(filePath: string): TsSummary {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lineCount = content.split('\n').length;

  const summary: TsSummary = {
    fileName: path.basename(filePath),
    role: 'Unknown',
    decorators: [],
    imports: {
      angular: [],
      thirdParty: [],
      relative: []
    },
    exports: [],
    classes: [],
    functions: [],
    interfaces: [],
    types: [],
    enums: [],
    lineCount
  };

  try {
    const ast = parse(content, {
      loc: true,
      range: true,
      comment: false
    });

    function traverse(node: any): void {
      if (!node) return;

      // デコレータを収集
      if (node.decorators && Array.isArray(node.decorators)) {
        node.decorators.forEach((dec: any) => {
          let decoratorName = '';
          if (dec.expression && dec.expression.callee && dec.expression.callee.name) {
            decoratorName = dec.expression.callee.name;
          } else if (dec.expression && dec.expression.name) {
            decoratorName = dec.expression.name;
          }
          if (decoratorName && !summary.decorators.includes(decoratorName)) {
            summary.decorators.push(decoratorName);
          }
        });
      }

      // Import文
      if (node.type === 'ImportDeclaration') {
        const source = node.source.value;
        if (source.startsWith('@angular/')) {
          summary.imports.angular.push(source);
        } else if (source.startsWith('.') || source.startsWith('/')) {
          summary.imports.relative.push(source);
        } else {
          summary.imports.thirdParty.push(source);
        }
      }

      // Export宣言
      if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
        if (node.declaration) {
          const decl = node.declaration;

          if (decl.type === 'ClassDeclaration' && decl.id) {
            summary.exports.push({ name: decl.id.name, type: 'class' });
          } else if (decl.type === 'FunctionDeclaration' && decl.id) {
            summary.exports.push({ name: decl.id.name, type: 'function' });
          } else if (decl.type === 'VariableDeclaration') {
            decl.declarations.forEach((varDecl: any) => {
              if (varDecl.id && varDecl.id.name) {
                summary.exports.push({ name: varDecl.id.name, type: 'variable' });
              }
            });
          } else if (decl.type === 'TSInterfaceDeclaration' && decl.id) {
            summary.exports.push({ name: decl.id.name, type: 'interface' });
          } else if (decl.type === 'TSTypeAliasDeclaration' && decl.id) {
            summary.exports.push({ name: decl.id.name, type: 'type' });
          } else if (decl.type === 'TSEnumDeclaration' && decl.id) {
            summary.exports.push({ name: decl.id.name, type: 'enum' });
          }
        }
      }

      // クラス
      if (node.type === 'ClassDeclaration' && node.id) {
        const implementsList: string[] = [];
        if (node.implements && Array.isArray(node.implements)) {
          node.implements.forEach((impl: any) => {
            if (impl.expression && impl.expression.name) {
              implementsList.push(impl.expression.name);
            }
          });
        }

        let extendsName: string | undefined;
        if (node.superClass && node.superClass.name) {
          extendsName = node.superClass.name;
        }

        summary.classes.push({
          name: node.id.name,
          implements: implementsList,
          extends: extendsName
        });
      }

      // 関数
      if (node.type === 'FunctionDeclaration' && node.id) {
        summary.functions.push({
          name: node.id.name,
          type: 'function',
          parameters: node.params.length
        });
      }

      // メソッド
      if (node.type === 'MethodDefinition' && node.key) {
        const name = node.key.type === 'Identifier' ? node.key.name : 'unknown';
        summary.functions.push({
          name,
          type: node.kind === 'constructor' ? 'constructor' : 'method',
          parameters: node.value.params.length
        });
      }

      // インターフェース
      if (node.type === 'TSInterfaceDeclaration' && node.id) {
        summary.interfaces.push(node.id.name);
      }

      // Type Alias
      if (node.type === 'TSTypeAliasDeclaration' && node.id) {
        summary.types.push(node.id.name);
      }

      // Enum
      if (node.type === 'TSEnumDeclaration' && node.id) {
        summary.enums.push(node.id.name);
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

    traverse(ast);

    // 役割を判定
    if (summary.decorators.includes('Component')) {
      summary.role = 'Angular Component';
    } else if (summary.decorators.includes('Injectable')) {
      if (filePath.includes('.service.')) {
        summary.role = 'Angular Service';
      } else if (filePath.includes('.guard.')) {
        summary.role = 'Angular Guard';
      } else if (filePath.includes('.interceptor.')) {
        summary.role = 'HTTP Interceptor';
      } else {
        summary.role = 'Injectable Service';
      }
    } else if (summary.decorators.includes('NgModule')) {
      summary.role = 'Angular Module';
    } else if (summary.decorators.includes('Pipe')) {
      summary.role = 'Angular Pipe';
    } else if (summary.decorators.includes('Directive')) {
      summary.role = 'Angular Directive';
    } else if (summary.interfaces.length > 0 || summary.types.length > 0) {
      summary.role = 'Type Definitions';
    } else if (summary.exports.length > 0) {
      summary.role = 'Utility/Helper';
    }
  } catch (error) {
    console.error('Error parsing TypeScript file:', error);
  }

  return summary;
}

function generateMarkdown(summary: TsSummary): string {
  let md = `# TypeScript Summary: ${summary.fileName}\n\n`;

  md += `## Overview\n\n`;
  md += `- **File Role**: ${summary.role}\n`;
  md += `- **Lines of Code**: ${summary.lineCount}\n`;
  md += `- **Classes**: ${summary.classes.length}\n`;
  md += `- **Functions/Methods**: ${summary.functions.length}\n`;
  md += `- **Interfaces**: ${summary.interfaces.length}\n`;
  md += `- **Type Aliases**: ${summary.types.length}\n`;
  md += `- **Enums**: ${summary.enums.length}\n\n`;

  // デコレータ
  if (summary.decorators.length > 0) {
    md += `## Decorators\n\n`;
    summary.decorators.forEach(dec => {
      md += `- \`@${dec}\`\n`;
    });
    md += `\n`;
  }

  // インポート
  const totalImports = summary.imports.angular.length +
                       summary.imports.thirdParty.length +
                       summary.imports.relative.length;

  if (totalImports > 0) {
    md += `## Imports (${totalImports})\n\n`;

    if (summary.imports.angular.length > 0) {
      md += `### Angular (${summary.imports.angular.length})\n\n`;
      const uniqueAngular = Array.from(new Set(summary.imports.angular));
      uniqueAngular.forEach(imp => md += `- \`${imp}\`\n`);
      md += `\n`;
    }

    if (summary.imports.thirdParty.length > 0) {
      md += `### Third Party (${summary.imports.thirdParty.length})\n\n`;
      const uniqueThirdParty = Array.from(new Set(summary.imports.thirdParty));
      uniqueThirdParty.forEach(imp => md += `- \`${imp}\`\n`);
      md += `\n`;
    }

    if (summary.imports.relative.length > 0) {
      md += `### Relative (${summary.imports.relative.length})\n\n`;
      const uniqueRelative = Array.from(new Set(summary.imports.relative));
      uniqueRelative.forEach(imp => md += `- \`${imp}\`\n`);
      md += `\n`;
    }
  }

  // エクスポート
  if (summary.exports.length > 0) {
    md += `## Exports\n\n`;
    md += `| Name | Type |\n`;
    md += `|------|------|\n`;
    summary.exports.forEach(exp => {
      md += `| ${exp.name} | ${exp.type} |\n`;
    });
    md += `\n`;
  }

  // クラス
  if (summary.classes.length > 0) {
    md += `## Classes\n\n`;
    summary.classes.forEach(cls => {
      md += `### ${cls.name}\n\n`;
      if (cls.extends) {
        md += `- **Extends**: \`${cls.extends}\`\n`;
      }
      if (cls.implements.length > 0) {
        md += `- **Implements**: ${cls.implements.map(i => `\`${i}\``).join(', ')}\n`;
      }
      md += `\n`;
    });
  }

  // 関数/メソッド
  if (summary.functions.length > 0) {
    md += `## Functions/Methods\n\n`;
    md += `| Name | Type | Parameters |\n`;
    md += `|------|------|------------|\n`;
    summary.functions.forEach(func => {
      md += `| ${func.name} | ${func.type} | ${func.parameters} |\n`;
    });
    md += `\n`;
  }

  // インターフェース
  if (summary.interfaces.length > 0) {
    md += `## Interfaces\n\n`;
    summary.interfaces.forEach(int => {
      md += `- \`${int}\`\n`;
    });
    md += `\n`;
  }

  // Type Aliases
  if (summary.types.length > 0) {
    md += `## Type Aliases\n\n`;
    summary.types.forEach(type => {
      md += `- \`${type}\`\n`;
    });
    md += `\n`;
  }

  // Enums
  if (summary.enums.length > 0) {
    md += `## Enums\n\n`;
    summary.enums.forEach(enm => {
      md += `- \`${enm}\`\n`;
    });
    md += `\n`;
  }

  md += `## Analysis Date\n\n`;
  md += `${new Date().toISOString()}\n`;

  return md;
}

function main(): void {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: TypeScript file not specified');
    console.error('Usage: npx ts-node src/summarize-ts.ts <ts-file>');
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
    console.log(`\n=== Analyzing: ${filePath} ===\n`);

    const summary = analyzeTs(filePath);
    const markdown = generateMarkdown(summary);

    // コンソールに出力
    console.log(markdown);

    // outputディレクトリに保存
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = path.basename(filePath, '.ts');
    const outputPath = path.join(outputDir, `${baseName}-summary.md`);

    fs.writeFileSync(outputPath, markdown);

    console.log(`\n=== Summary saved to: ${outputPath} ===`);
  } catch (error) {
    console.error('Error analyzing TypeScript file:', error);
    process.exit(1);
  }
}

main();
