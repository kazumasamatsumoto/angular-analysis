#!/usr/bin/env ts-node

/**
 * summarize-html.ts
 * HTMLファイルをMarkdownサマリ化
 *
 * Usage: npx ts-node src/summarize-html.ts <html-file>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse, HTMLElement } from 'node-html-parser';

interface HtmlSummary {
  fileName: string;
  totalElements: number;
  components: string[];
  directives: {
    ngIf: number;
    ngFor: number;
    ngSwitch: number;
    ngModel: number;
    others: string[];
  };
  structure: string;
  forms: {
    count: number;
    inputs: number;
    buttons: number;
  };
  links: {
    internal: number;
    external: number;
  };
}

function analyzeHtml(filePath: string): HtmlSummary {
  const content = fs.readFileSync(filePath, 'utf-8');
  const root = parse(content);

  const allElements = root.querySelectorAll('*');
  const components = new Set<string>();
  const otherDirectives = new Set<string>();

  let ngIfCount = 0;
  let ngForCount = 0;
  let ngSwitchCount = 0;
  let ngModelCount = 0;

  allElements.forEach(el => {
    // コンポーネント検出
    if (el.tagName.includes('-')) {
      components.add(el.tagName.toLowerCase());
    }

    // ディレクティブ検出
    if (el.hasAttribute('*ngIf')) ngIfCount++;
    if (el.hasAttribute('*ngFor')) ngForCount++;
    if (el.hasAttribute('[ngSwitch]') || el.hasAttribute('*ngSwitchCase')) ngSwitchCount++;
    if (el.hasAttribute('[(ngModel)]') || el.hasAttribute('[ngModel]')) ngModelCount++;

    // その他のAngularディレクティブ
    const attrs = el.rawAttrs;
    if (attrs) {
      const angularDirectives = attrs.match(/\[(.*?)\]|\((.*?)\)|\*\w+/g);
      if (angularDirectives) {
        angularDirectives.forEach(dir => {
          if (!dir.includes('ngIf') && !dir.includes('ngFor') && !dir.includes('ngSwitch') && !dir.includes('ngModel')) {
            otherDirectives.add(dir);
          }
        });
      }
    }
  });

  // フォーム関連
  const forms = root.querySelectorAll('form');
  const inputs = root.querySelectorAll('input, textarea, select');
  const buttons = root.querySelectorAll('button');

  // リンク解析
  const links = root.querySelectorAll('a');
  let internalLinks = 0;
  let externalLinks = 0;

  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        externalLinks++;
      } else {
        internalLinks++;
      }
    }
  });

  // 構造ツリーを生成
  const structure = generateStructureTree(root);

  return {
    fileName: path.basename(filePath),
    totalElements: allElements.length,
    components: Array.from(components),
    directives: {
      ngIf: ngIfCount,
      ngFor: ngForCount,
      ngSwitch: ngSwitchCount,
      ngModel: ngModelCount,
      others: Array.from(otherDirectives)
    },
    structure,
    forms: {
      count: forms.length,
      inputs: inputs.length,
      buttons: buttons.length
    },
    links: {
      internal: internalLinks,
      external: externalLinks
    }
  };
}

function generateStructureTree(root: any, maxDepth: number = 3): string {
  let result = '';

  function traverse(node: any, depth: number, prefix: string): void {
    if (depth > maxDepth || !node) return;

    if (node.nodeType === 1) {
      const element = node as HTMLElement;
      const tagName = element.tagName?.toLowerCase();

      if (!tagName) return; // Skip if tagName is null
      const id = element.getAttribute('id');
      const classes = element.getAttribute('class');

      let label = `<${tagName}>`;
      if (id) label += ` #${id}`;
      if (classes) label += ` .${classes.split(' ')[0]}`;

      result += `${prefix}${label}\n`;

      const children = element.childNodes.filter((child: any) => child.nodeType === 1);
      children.forEach((child: any, index: number) => {
        const isLast = index === children.length - 1;
        const newPrefix = prefix + (isLast ? '  └─ ' : '  ├─ ');
        traverse(child, depth + 1, newPrefix);
      });
    }
  }

  traverse(root, 0, '');
  return result;
}

function generateMarkdown(summary: HtmlSummary): string {
  let md = `# HTML Summary: ${summary.fileName}\n\n`;

  md += `## Overview\n\n`;
  md += `- **Total Elements**: ${summary.totalElements}\n`;
  md += `- **Angular Components Used**: ${summary.components.length}\n`;
  md += `- **Forms**: ${summary.forms.count}\n`;
  md += `- **Interactive Elements**: ${summary.forms.inputs} inputs, ${summary.forms.buttons} buttons\n`;
  md += `- **Links**: ${summary.links.internal} internal, ${summary.links.external} external\n\n`;

  if (summary.components.length > 0) {
    md += `## Angular Components\n\n`;
    summary.components.forEach(comp => {
      md += `- \`${comp}\`\n`;
    });
    md += `\n`;
  }

  md += `## Angular Directives\n\n`;
  md += `| Directive | Count |\n`;
  md += `|-----------|-------|\n`;
  md += `| *ngIf | ${summary.directives.ngIf} |\n`;
  md += `| *ngFor | ${summary.directives.ngFor} |\n`;
  md += `| *ngSwitch | ${summary.directives.ngSwitch} |\n`;
  md += `| [(ngModel)] | ${summary.directives.ngModel} |\n\n`;

  if (summary.directives.others.length > 0) {
    md += `### Other Directives\n\n`;
    summary.directives.others.forEach(dir => {
      md += `- \`${dir}\`\n`;
    });
    md += `\n`;
  }

  if (summary.forms.count > 0) {
    md += `## Forms\n\n`;
    md += `This template contains ${summary.forms.count} form(s) with:\n`;
    md += `- ${summary.forms.inputs} input fields\n`;
    md += `- ${summary.forms.buttons} buttons\n\n`;
  }

  md += `## Structure (Top 3 Levels)\n\n`;
  md += '```\n';
  md += summary.structure;
  md += '```\n\n';

  md += `## Analysis Date\n\n`;
  md += `${new Date().toISOString()}\n`;

  return md;
}

function main(): void {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: HTML file not specified');
    console.error('Usage: npx ts-node src/summarize-html.ts <html-file>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File "${filePath}" does not exist`);
    process.exit(1);
  }

  if (!filePath.endsWith('.html')) {
    console.error(`Error: "${filePath}" is not an HTML file`);
    process.exit(1);
  }

  try {
    console.log(`\n=== Analyzing: ${filePath} ===\n`);

    const summary = analyzeHtml(filePath);
    const markdown = generateMarkdown(summary);

    // コンソールに出力
    console.log(markdown);

    // outputディレクトリに保存
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = path.basename(filePath, '.html');
    const outputPath = path.join(outputDir, `${baseName}-summary.md`);

    fs.writeFileSync(outputPath, markdown);

    console.log(`\n=== Summary saved to: ${outputPath} ===`);
  } catch (error) {
    console.error('Error analyzing HTML file:', error);
    process.exit(1);
  }
}

main();
