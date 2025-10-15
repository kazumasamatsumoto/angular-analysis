#!/usr/bin/env ts-node

/**
 * analyze-ts-role.ts
 * TypeScriptファイルの役割を判定
 *
 * Usage: npx ts-node src/analyze-ts-role.ts <ts-file>
 */

import * as fs from 'fs';
import { parse } from '@typescript-eslint/typescript-estree';

interface RoleAnalysis {
  primaryRole: string;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
  description: string;
  decorators: string[];
  exports: string[];
}

function analyzeRole(filePath: string): RoleAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8');
  const indicators: string[] = [];
  const decorators: string[] = [];
  const exports: string[] = [];

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
          if (dec.expression && dec.expression.callee && dec.expression.callee.name) {
            decorators.push(dec.expression.callee.name);
          } else if (dec.expression && dec.expression.name) {
            decorators.push(dec.expression.name);
          }
        });
      }

      // Export宣言を収集
      if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
        if (node.declaration) {
          if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
            exports.push(node.declaration.id.name);
          } else if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
            exports.push(node.declaration.id.name);
          } else if (node.declaration.type === 'VariableDeclaration') {
            node.declaration.declarations.forEach((decl: any) => {
              if (decl.id && decl.id.name) {
                exports.push(decl.id.name);
              }
            });
          }
        }
      }

      // クラス実装のインターフェースをチェック
      if (node.type === 'ClassDeclaration') {
        if (node.implements && Array.isArray(node.implements)) {
          node.implements.forEach((impl: any) => {
            if (impl.expression && impl.expression.name) {
              indicators.push(`Implements: ${impl.expression.name}`);
            }
          });
        }
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
  } catch (error) {
    console.error('Error parsing TypeScript file:', error);
  }

  // ファイル名からの推測
  const fileName = filePath.toLowerCase();
  if (fileName.includes('.service.')) indicators.push('File name contains .service');
  if (fileName.includes('.component.')) indicators.push('File name contains .component');
  if (fileName.includes('.module.')) indicators.push('File name contains .module');
  if (fileName.includes('.pipe.')) indicators.push('File name contains .pipe');
  if (fileName.includes('.directive.')) indicators.push('File name contains .directive');
  if (fileName.includes('.guard.')) indicators.push('File name contains .guard');
  if (fileName.includes('.interceptor.')) indicators.push('File name contains .interceptor');
  if (fileName.includes('.resolver.')) indicators.push('File name contains .resolver');
  if (fileName.includes('.model.')) indicators.push('File name contains .model');
  if (fileName.includes('.interface.')) indicators.push('File name contains .interface');

  // 役割を判定
  let primaryRole = 'Unknown';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let description = '';

  if (decorators.includes('Component')) {
    primaryRole = 'Component';
    confidence = 'high';
    description = 'Angularコンポーネント。UIの表示とユーザーインタラクションを担当します。';
  } else if (decorators.includes('Injectable')) {
    if (fileName.includes('.service.')) {
      primaryRole = 'Service';
      confidence = 'high';
      description = 'Angularサービス。ビジネスロジックやデータ操作を提供します。';
    } else if (fileName.includes('.guard.')) {
      primaryRole = 'Guard';
      confidence = 'high';
      description = 'ルートガード。ナビゲーションの前にアクセス制御を行います。';
    } else if (fileName.includes('.interceptor.')) {
      primaryRole = 'Interceptor';
      confidence = 'high';
      description = 'HTTPインターセプター。HTTPリクエスト/レスポンスを加工します。';
    } else if (fileName.includes('.resolver.')) {
      primaryRole = 'Resolver';
      confidence = 'high';
      description = 'ルートリゾルバー。ルート遷移前にデータを取得します。';
    } else {
      primaryRole = 'Injectable Service';
      confidence = 'medium';
      description = '注入可能なサービス。依存性注入を通じて機能を提供します。';
    }
  } else if (decorators.includes('NgModule')) {
    primaryRole = 'Module';
    confidence = 'high';
    description = 'Angularモジュール。関連するコンポーネント、サービス、ディレクティブをまとめます。';
  } else if (decorators.includes('Pipe')) {
    primaryRole = 'Pipe';
    confidence = 'high';
    description = 'Angularパイプ。テンプレート内でデータを変換します。';
  } else if (decorators.includes('Directive')) {
    primaryRole = 'Directive';
    confidence = 'high';
    description = 'Angularディレクティブ。DOM要素に振る舞いを追加します。';
  } else if (fileName.includes('.model.') || fileName.includes('.interface.')) {
    primaryRole = 'Model/Interface';
    confidence = 'medium';
    description = 'データモデルまたはインターフェース定義。型情報を提供します。';
    indicators.push('Likely contains type definitions');
  } else if (exports.length > 0) {
    primaryRole = 'Utility/Helper';
    confidence = 'low';
    description = 'ユーティリティまたはヘルパー。共通機能を提供する可能性があります。';
  }

  return {
    primaryRole,
    confidence,
    indicators,
    description,
    decorators,
    exports
  };
}

function main(): void {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: TypeScript file not specified');
    console.error('Usage: npx ts-node src/analyze-ts-role.ts <ts-file>');
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

    const analysis = analyzeRole(filePath);

    console.log(`Primary Role: ${analysis.primaryRole}`);
    console.log(`Confidence: ${analysis.confidence.toUpperCase()}`);
    console.log(`\nDescription:`);
    console.log(`  ${analysis.description}`);

    if (analysis.decorators.length > 0) {
      console.log(`\nDecorators Found:`);
      analysis.decorators.forEach(dec => console.log(`  - @${dec}`));
    }

    if (analysis.exports.length > 0) {
      console.log(`\nExports:`);
      analysis.exports.forEach(exp => console.log(`  - ${exp}`));
    }

    if (analysis.indicators.length > 0) {
      console.log(`\nIndicators:`);
      analysis.indicators.forEach(ind => console.log(`  - ${ind}`));
    }

    // JSON出力
    console.log('\n=== JSON Output ===');
    console.log(JSON.stringify(analysis, null, 2));
  } catch (error) {
    console.error('Error analyzing TypeScript file:', error);
    process.exit(1);
  }
}

main();
