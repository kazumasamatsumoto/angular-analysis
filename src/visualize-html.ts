#!/usr/bin/env ts-node

/**
 * visualize-html.ts
 * HTMLファイルのDOM構造をツリー形式で可視化
 *
 * Usage: npx ts-node src/visualize-html.ts <html-file>
 */

import * as fs from 'fs';
import { parse, HTMLElement, Node } from 'node-html-parser';

function visualizeTree(node: Node, indent: string = '', isLast: boolean = true): string {
  let result = '';

  if (node.nodeType === 1) { // Element node
    const element = node as HTMLElement;
    const tagName = element.tagName?.toLowerCase();

    if (!tagName) return result; // Skip if tagName is null

    const prefix = indent + (isLast ? '└── ' : '├── ');

    // 属性情報を取得
    const attrs: string[] = [];
    const id = element.getAttribute('id');
    const classes = element.getAttribute('class');
    const ngIf = element.getAttribute('*ngIf');
    const ngFor = element.getAttribute('*ngFor');
    const ngSwitch = element.getAttribute('[ngSwitch]');

    if (id) attrs.push(`#${id}`);
    if (classes) attrs.push(`.${classes.split(' ').join('.')}`);
    if (ngIf) attrs.push(`*ngIf="${ngIf}"`);
    if (ngFor) attrs.push(`*ngFor="${ngFor}"`);
    if (ngSwitch) attrs.push(`[ngSwitch]="${ngSwitch}"`);

    // カスタム要素（Angularコンポーネント）を検出
    const isComponent = tagName.includes('-');
    const componentMarker = isComponent ? ' [Component]' : '';

    const attrString = attrs.length > 0 ? ` (${attrs.join(', ')})` : '';
    result += `${prefix}<${tagName}>${attrString}${componentMarker}\n`;

    // 子要素を処理
    const children = element.childNodes.filter(child => child.nodeType === 1);
    children.forEach((child, index) => {
      const childIndent = indent + (isLast ? '    ' : '│   ');
      const childIsLast = index === children.length - 1;
      result += visualizeTree(child, childIndent, childIsLast);
    });
  }

  return result;
}

function analyzeHtml(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const root = parse(content);

  console.log(`\n=== HTML Structure: ${filePath} ===\n`);

  // ツリー構造を出力
  const tree = visualizeTree(root);
  console.log(tree);

  // 統計情報を収集
  const allElements = root.querySelectorAll('*');
  const components = allElements.filter(el => el.tagName.includes('-'));
  const directivesWithNgIf = allElements.filter(el => el.hasAttribute('*ngIf'));
  const directivesWithNgFor = allElements.filter(el => el.hasAttribute('*ngFor'));

  console.log('\n=== Statistics ===');
  console.log(`Total elements: ${allElements.length}`);
  console.log(`Angular components: ${components.length}`);
  console.log(`*ngIf directives: ${directivesWithNgIf.length}`);
  console.log(`*ngFor directives: ${directivesWithNgFor.length}`);

  // コンポーネント一覧
  if (components.length > 0) {
    console.log('\n=== Components Used ===');
    const componentNames = new Set(components.map(c => c.tagName.toLowerCase()));
    componentNames.forEach(name => console.log(`  - ${name}`));
  }
}

function main(): void {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: HTML file not specified');
    console.error('Usage: npx ts-node src/visualize-html.ts <html-file>');
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
    analyzeHtml(filePath);
  } catch (error) {
    console.error('Error analyzing HTML file:', error);
    process.exit(1);
  }
}

main();
