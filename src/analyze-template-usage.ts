#!/usr/bin/env ts-node

/**
 * analyze-template-usage.ts
 * テンプレート内のコンポーネント/ディレクティブ/パイプ使用状況を解析
 *
 * Usage: npx ts-node src/analyze-template-usage.ts <component-file>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseHtml } from 'node-html-parser';
import { parse as parseTs } from '@typescript-eslint/typescript-estree';

// ==================== Interfaces ====================

interface TemplateUsageAnalysis {
  component: string;
  componentPath: string;
  template: string;
  templateType: 'inline' | 'external';
  usedComponents: ComponentUsage[];
  usedDirectives: DirectiveUsage[];
  usedPipes: PipeUsage[];
  unusedImports: string[];
  missingDeclarations: string[];
  warnings: Warning[];
}

interface ComponentUsage {
  selector: string;
  count: number;
  component?: string;
  module?: string;
}

interface DirectiveUsage {
  directive: string;
  count: number;
  type: 'structural' | 'attribute';
}

interface PipeUsage {
  pipe: string;
  count: number;
}

interface Warning {
  type: 'warning' | 'error' | 'info';
  message: string;
}

// ==================== Template Usage Analyzer ====================

class TemplateUsageAnalyzer {
  private componentPath: string;
  private projectRoot: string;

  constructor(componentPath: string) {
    this.componentPath = componentPath;
    this.projectRoot = this.findProjectRoot(componentPath);
  }

  analyze(): TemplateUsageAnalysis {
    console.log(`Analyzing template usage for: ${this.componentPath}\n`);

    const componentContent = fs.readFileSync(this.componentPath, 'utf-8');
    const componentName = this.extractComponentName(componentContent);
    const template = this.extractTemplate(componentContent);
    const templateType = template.type;

    console.log(`Component: ${componentName}`);
    console.log(`Template Type: ${templateType}\n`);

    // テンプレート解析
    const usedComponents = this.extractUsedComponents(template.content);
    const usedDirectives = this.extractUsedDirectives(template.content);
    const usedPipes = this.extractUsedPipes(template.content);

    // コンポーネントのインポート解析
    const imports = this.extractComponentImports(componentContent);

    // 未使用インポートと不足宣言の検出
    const unusedImports = this.findUnusedImports(imports, usedComponents, usedDirectives, usedPipes);
    const missingDeclarations: string[] = []; // 簡易版では未実装

    // 警告の生成
    const warnings = this.generateWarnings(unusedImports, missingDeclarations);

    return {
      component: componentName,
      componentPath: path.relative(this.projectRoot, this.componentPath),
      template: template.content,
      templateType,
      usedComponents,
      usedDirectives,
      usedPipes,
      unusedImports,
      missingDeclarations,
      warnings
    };
  }

  private findProjectRoot(filePath: string): string {
    let dir = path.dirname(filePath);
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    return path.dirname(filePath);
  }

  private extractComponentName(content: string): string {
    const classMatch = content.match(/export\s+class\s+(\w+)/);
    return classMatch ? classMatch[1] : 'Unknown';
  }

  private extractTemplate(content: string): { content: string; type: 'inline' | 'external' } {
    // templateUrlを探す
    const templateUrlMatch = content.match(/templateUrl:\s*['"`]([^'"`]+)['"`]/);
    if (templateUrlMatch) {
      const templatePath = path.resolve(path.dirname(this.componentPath), templateUrlMatch[1]);
      if (fs.existsSync(templatePath)) {
        return {
          content: fs.readFileSync(templatePath, 'utf-8'),
          type: 'external'
        };
      }
    }

    // インラインテンプレートを探す
    const templateMatch = content.match(/template:\s*['"`]([\s\S]*?)['"`]/);
    if (templateMatch) {
      return {
        content: templateMatch[1],
        type: 'inline'
      };
    }

    // バッククォートのインラインテンプレート
    const templateBacktickMatch = content.match(/template:\s*`([\s\S]*?)`/);
    if (templateBacktickMatch) {
      return {
        content: templateBacktickMatch[1],
        type: 'inline'
      };
    }

    return { content: '', type: 'inline' };
  }

  private extractUsedComponents(template: string): ComponentUsage[] {
    const components = new Map<string, number>();

    try {
      const root = parseHtml(template);

      // すべての要素を走査
      const traverse = (node: any): void => {
        if (node.nodeType === 1) { // ELEMENT_NODE
          const tagName = node.rawTagName?.toLowerCase();

          // カスタムコンポーネント（ハイフン含む）またはapp-始まりのタグ
          if (tagName && (tagName.includes('-') || tagName.startsWith('app'))) {
            components.set(tagName, (components.get(tagName) || 0) + 1);
          }
        }

        if (node.childNodes) {
          node.childNodes.forEach((child: any) => traverse(child));
        }
      };

      traverse(root);
    } catch (error) {
      console.warn('Warning: Failed to parse HTML template');
    }

    // Angularの標準セレクタを追加（router-outlet等）
    const angularSelectors = ['router-outlet', 'ng-container', 'ng-content', 'ng-template'];
    for (const selector of angularSelectors) {
      const regex = new RegExp(`<${selector}[\\s>]`, 'g');
      const matches = template.match(regex);
      if (matches) {
        components.set(selector, matches.length);
      }
    }

    return Array.from(components.entries()).map(([selector, count]) => ({
      selector,
      count
    }));
  }

  private extractUsedDirectives(template: string): DirectiveUsage[] {
    const directives = new Map<string, { count: number; type: 'structural' | 'attribute' }>();

    // 構造ディレクティブ (*ngIf, *ngFor 等)
    const structuralRegex = /\*(\w+)/g;
    let match;
    while ((match = structuralRegex.exec(template)) !== null) {
      const directive = `*${match[1]}`;
      const existing = directives.get(directive);
      directives.set(directive, {
        count: existing ? existing.count + 1 : 1,
        type: 'structural'
      });
    }

    // 属性ディレクティブ ([routerLink], [class], [ngClass] 等)
    const attributeRegex = /\[(\w+)\]/g;
    while ((match = attributeRegex.exec(template)) !== null) {
      const directive = `[${match[1]}]`;
      const existing = directives.get(directive);
      directives.set(directive, {
        count: existing ? existing.count + 1 : 1,
        type: 'attribute'
      });
    }

    // イベントバインディング ((click), (submit) 等)
    const eventRegex = /\((\w+)\)/g;
    while ((match = eventRegex.exec(template)) !== null) {
      const directive = `(${match[1]})`;
      const existing = directives.get(directive);
      directives.set(directive, {
        count: existing ? existing.count + 1 : 1,
        type: 'attribute'
      });
    }

    return Array.from(directives.entries()).map(([directive, info]) => ({
      directive,
      count: info.count,
      type: info.type
    }));
  }

  private extractUsedPipes(template: string): PipeUsage[] {
    const pipes = new Map<string, number>();

    // パイプの使用を検出 ({{ value | pipeName }})
    const pipeRegex = /\|\s*(\w+)/g;
    let match;
    while ((match = pipeRegex.exec(template)) !== null) {
      const pipe = match[1];
      pipes.set(pipe, (pipes.get(pipe) || 0) + 1);
    }

    return Array.from(pipes.entries()).map(([pipe, count]) => ({
      pipe,
      count
    }));
  }

  private extractComponentImports(content: string): string[] {
    const imports: string[] = [];

    try {
      const ast = parseTs(content, {
        loc: true,
        range: true,
        comment: false
      });

      const traverse = (node: any): void => {
        if (!node) return;

        if (node.type === 'ImportDeclaration') {
          if (node.specifiers && node.specifiers.length > 0) {
            node.specifiers.forEach((spec: any) => {
              if (spec.type === 'ImportSpecifier' || spec.type === 'ImportDefaultSpecifier') {
                imports.push(spec.local.name);
              }
            });
          }
        }

        for (const key in node) {
          if (node[key] && typeof node[key] === 'object') {
            if (Array.isArray(node[key])) {
              node[key].forEach((child: any) => traverse(child));
            } else {
              traverse(node[key]);
            }
          }
        }
      };

      traverse(ast);
    } catch (error) {
      console.warn('Warning: Failed to parse component imports');
    }

    return imports;
  }

  private findUnusedImports(
    imports: string[],
    components: ComponentUsage[],
    directives: DirectiveUsage[],
    pipes: PipeUsage[]
  ): string[] {
    // 簡易版: インポート名がテンプレート内で使われているか確認
    // 実際にはもっと詳細な解析が必要
    const unused: string[] = [];

    for (const imp of imports) {
      // コンポーネント名とセレクタのマッチングは複雑なので簡易判定
      // 実際の実装ではモジュールのdeclarationsを見る必要がある
      if (
        imp.endsWith('Component') &&
        !components.some(c => c.selector.includes(imp.toLowerCase().replace('component', '')))
      ) {
        // この判定は簡易版
      }
    }

    return unused;
  }

  private generateWarnings(unusedImports: string[], missingDeclarations: string[]): Warning[] {
    const warnings: Warning[] = [];

    unusedImports.forEach(imp => {
      warnings.push({
        type: 'warning',
        message: `Potentially unused import: ${imp}`
      });
    });

    missingDeclarations.forEach(decl => {
      warnings.push({
        type: 'error',
        message: `Missing declaration: ${decl}`
      });
    });

    return warnings;
  }
}

// ==================== Output Formatters ====================

function formatMarkdown(analysis: TemplateUsageAnalysis): string {
  let md = `# Template Usage Analysis: ${analysis.component}\n\n`;

  md += `**Component Path**: ${analysis.componentPath}\n`;
  md += `**Template Type**: ${analysis.templateType}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Components Used**: ${analysis.usedComponents.length}\n`;
  md += `- **Directives Used**: ${analysis.usedDirectives.length}\n`;
  md += `- **Pipes Used**: ${analysis.usedPipes.length}\n`;
  md += `- **Warnings**: ${analysis.warnings.length}\n\n`;

  if (analysis.usedComponents.length > 0) {
    md += `## Used Components\n\n`;
    md += `| Selector | Occurrences |\n`;
    md += `|----------|-------------|\n`;
    analysis.usedComponents.forEach(c => {
      md += `| ${c.selector} | ${c.count} |\n`;
    });
    md += `\n`;
  }

  if (analysis.usedDirectives.length > 0) {
    md += `## Used Directives\n\n`;
    md += `| Directive | Type | Occurrences |\n`;
    md += `|-----------|------|-------------|\n`;
    analysis.usedDirectives.forEach(d => {
      md += `| ${d.directive} | ${d.type} | ${d.count} |\n`;
    });
    md += `\n`;
  }

  if (analysis.usedPipes.length > 0) {
    md += `## Used Pipes\n\n`;
    md += `| Pipe | Occurrences |\n`;
    md += `|------|-------------|\n`;
    analysis.usedPipes.forEach(p => {
      md += `| ${p.pipe} | ${p.count} |\n`;
    });
    md += `\n`;
  }

  if (analysis.warnings.length > 0) {
    md += `## ⚠️ Warnings\n\n`;
    analysis.warnings.forEach(w => {
      const icon = w.type === 'error' ? '🔴' : w.type === 'warning' ? '🟡' : 'ℹ️';
      md += `${icon} **${w.type.toUpperCase()}**: ${w.message}\n`;
    });
    md += `\n`;
  }

  return md;
}

function formatConsole(analysis: TemplateUsageAnalysis): void {
  console.log(`\n📊 Template Usage Analysis: ${analysis.component}\n`);
  console.log(`Component Path: ${analysis.componentPath}`);
  console.log(`Template Type: ${analysis.templateType}\n`);

  console.log(`Summary:`);
  console.log(`  - Components: ${analysis.usedComponents.length}`);
  console.log(`  - Directives: ${analysis.usedDirectives.length}`);
  console.log(`  - Pipes: ${analysis.usedPipes.length}`);
  console.log(`  - Warnings: ${analysis.warnings.length}\n`);

  if (analysis.usedComponents.length > 0) {
    console.log(`Used Components:`);
    analysis.usedComponents.forEach(c => {
      console.log(`  - ${c.selector} (${c.count} occurrence${c.count > 1 ? 's' : ''})`);
    });
    console.log('');
  }

  if (analysis.usedDirectives.length > 0) {
    console.log(`Used Directives:`);
    analysis.usedDirectives.forEach(d => {
      console.log(`  - ${d.directive} [${d.type}] (${d.count} occurrence${d.count > 1 ? 's' : ''})`);
    });
    console.log('');
  }

  if (analysis.usedPipes.length > 0) {
    console.log(`Used Pipes:`);
    analysis.usedPipes.forEach(p => {
      console.log(`  - ${p.pipe} (${p.count} occurrence${p.count > 1 ? 's' : ''})`);
    });
    console.log('');
  }

  if (analysis.warnings.length > 0) {
    console.log(`⚠️  Warnings:`);
    analysis.warnings.forEach(w => {
      const icon = w.type === 'error' ? '🔴' : w.type === 'warning' ? '🟡' : 'ℹ️';
      console.log(`  ${icon} ${w.message}`);
    });
    console.log('');
  }
}

// ==================== Main ====================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npx ts-node src/analyze-template-usage.ts <component-file> [options]

Options:
  --save <path>      Save output to file
  --help             Show this help message

Examples:
  npx ts-node src/analyze-template-usage.ts ./src/app/app.component.ts
  npx ts-node src/analyze-template-usage.ts ./src/app/app.component.ts --save template-usage.md
`);
    process.exit(0);
  }

  const componentFile = args[0];
  const savePath = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;

  if (!fs.existsSync(componentFile)) {
    console.error(`Error: Component file "${componentFile}" does not exist`);
    process.exit(1);
  }

  const analyzer = new TemplateUsageAnalyzer(componentFile);
  const analysis = analyzer.analyze();

  formatConsole(analysis);

  if (savePath) {
    const markdown = formatMarkdown(analysis);
    fs.writeFileSync(savePath, markdown);
    console.log(`✓ Saved to ${savePath}`);
  }
}

main();
