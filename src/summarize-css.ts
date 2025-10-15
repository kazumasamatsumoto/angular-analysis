#!/usr/bin/env ts-node

/**
 * summarize-css.ts
 * CSSファイルをMarkdownサマリ化
 *
 * Usage: npx ts-node src/summarize-css.ts <css-file>
 */

import * as fs from 'fs';
import * as path from 'path';
import * as csstree from 'css-tree';

interface CssSummary {
  fileName: string;
  totalRules: number;
  selectors: {
    classes: Set<string>;
    ids: Set<string>;
    elements: Set<string>;
    pseudoClasses: Set<string>;
  };
  properties: Map<string, number>;
  mediaQueries: string[];
  keyframes: string[];
  imports: string[];
  colors: Set<string>;
  layoutMethods: {
    flexbox: boolean;
    grid: boolean;
    float: boolean;
    position: boolean;
  };
}

function analyzeCss(filePath: string): CssSummary {
  const content = fs.readFileSync(filePath, 'utf-8');

  const summary: CssSummary = {
    fileName: path.basename(filePath),
    totalRules: 0,
    selectors: {
      classes: new Set(),
      ids: new Set(),
      elements: new Set(),
      pseudoClasses: new Set()
    },
    properties: new Map(),
    mediaQueries: [],
    keyframes: [],
    imports: [],
    colors: new Set(),
    layoutMethods: {
      flexbox: false,
      grid: false,
      float: false,
      position: false
    }
  };

  try {
    const ast = csstree.parse(content, {
      positions: true,
      parseAtrulePrelude: false,
      parseCustomProperty: false
    });

    csstree.walk(ast, {
      visit: 'Rule',
      enter(node: any) {
        summary.totalRules++;

        // セレクタを解析
        if (node.prelude && node.prelude.type === 'SelectorList') {
          const selectorText = csstree.generate(node.prelude);

          // クラスセレクタ
          const classes = selectorText.match(/\.[\w-]+/g);
          if (classes) {
            classes.forEach(cls => summary.selectors.classes.add(cls.substring(1)));
          }

          // IDセレクタ
          const ids = selectorText.match(/#[\w-]+/g);
          if (ids) {
            ids.forEach(id => summary.selectors.ids.add(id.substring(1)));
          }

          // 要素セレクタ
          const elements = selectorText.match(/\b[a-z][\w-]*(?=[\s,.:[\]>+~{]|$)/g);
          if (elements) {
            elements.forEach(el => {
              if (!['and', 'or', 'not'].includes(el)) {
                summary.selectors.elements.add(el);
              }
            });
          }

          // 疑似クラス
          const pseudoClasses = selectorText.match(/:[\w-]+/g);
          if (pseudoClasses) {
            pseudoClasses.forEach(pc => summary.selectors.pseudoClasses.add(pc));
          }
        }

        // プロパティを解析
        if (node.block && node.block.type === 'Block') {
          csstree.walk(node.block, {
            visit: 'Declaration',
            enter(declNode: any) {
              const property = declNode.property;
              const value = csstree.generate(declNode.value);

              // プロパティのカウント
              summary.properties.set(property, (summary.properties.get(property) || 0) + 1);

              // レイアウト手法の検出
              if (property === 'display' && value.includes('flex')) {
                summary.layoutMethods.flexbox = true;
              }
              if (property === 'display' && value.includes('grid')) {
                summary.layoutMethods.grid = true;
              }
              if (property === 'float') {
                summary.layoutMethods.float = true;
              }
              if (property === 'position' && !value.includes('static')) {
                summary.layoutMethods.position = true;
              }

              // 色の抽出
              const colorPatterns = [
                /#[0-9a-fA-F]{3,8}/g,  // hex
                /rgb\([^)]+\)/g,        // rgb
                /rgba\([^)]+\)/g,       // rgba
                /hsl\([^)]+\)/g,        // hsl
                /hsla\([^)]+\)/g        // hsla
              ];

              colorPatterns.forEach(pattern => {
                const matches = value.match(pattern);
                if (matches) {
                  matches.forEach(color => summary.colors.add(color));
                }
              });
            }
          });
        }
      }
    });

    // @media クエリを解析
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node: any) {
        if (node.name === 'media') {
          const query = csstree.generate(node.prelude);
          summary.mediaQueries.push(query);
        } else if (node.name === 'keyframes') {
          const name = csstree.generate(node.prelude);
          summary.keyframes.push(name);
        } else if (node.name === 'import') {
          const importPath = csstree.generate(node.prelude);
          summary.imports.push(importPath);
        }
      }
    });
  } catch (error) {
    console.error('Error parsing CSS:', error);
  }

  return summary;
}

function generateMarkdown(summary: CssSummary): string {
  let md = `# CSS Summary: ${summary.fileName}\n\n`;

  md += `## Overview\n\n`;
  md += `- **Total Rules**: ${summary.totalRules}\n`;
  md += `- **Class Selectors**: ${summary.selectors.classes.size}\n`;
  md += `- **ID Selectors**: ${summary.selectors.ids.size}\n`;
  md += `- **Element Selectors**: ${summary.selectors.elements.size}\n`;
  md += `- **Media Queries**: ${summary.mediaQueries.length}\n`;
  md += `- **Keyframe Animations**: ${summary.keyframes.length}\n`;
  md += `- **Colors Used**: ${summary.colors.size}\n\n`;

  // レイアウト手法
  md += `## Layout Methods\n\n`;
  md += `- **Flexbox**: ${summary.layoutMethods.flexbox ? '✓ Used' : '✗ Not used'}\n`;
  md += `- **Grid**: ${summary.layoutMethods.grid ? '✓ Used' : '✗ Not used'}\n`;
  md += `- **Float**: ${summary.layoutMethods.float ? '✓ Used' : '✗ Not used'}\n`;
  md += `- **Positioning**: ${summary.layoutMethods.position ? '✓ Used' : '✗ Not used'}\n\n`;

  // 最も使用されているプロパティ
  if (summary.properties.size > 0) {
    const sortedProps = Array.from(summary.properties.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    md += `## Top 10 CSS Properties\n\n`;
    md += `| Property | Usage Count |\n`;
    md += `|----------|-------------|\n`;
    sortedProps.forEach(([prop, count]) => {
      md += `| ${prop} | ${count} |\n`;
    });
    md += `\n`;
  }

  // クラス一覧（最大20個）
  if (summary.selectors.classes.size > 0) {
    md += `## CSS Classes\n\n`;
    const classes = Array.from(summary.selectors.classes).slice(0, 20);
    md += '```\n';
    classes.forEach(cls => md += `.${cls}\n`);
    if (summary.selectors.classes.size > 20) {
      md += `... and ${summary.selectors.classes.size - 20} more\n`;
    }
    md += '```\n\n';
  }

  // メディアクエリ
  if (summary.mediaQueries.length > 0) {
    md += `## Media Queries\n\n`;
    summary.mediaQueries.forEach((query, index) => {
      md += `${index + 1}. \`@media ${query}\`\n`;
    });
    md += `\n`;
  }

  // キーフレームアニメーション
  if (summary.keyframes.length > 0) {
    md += `## Keyframe Animations\n\n`;
    summary.keyframes.forEach(name => {
      md += `- \`@keyframes ${name}\`\n`;
    });
    md += `\n`;
  }

  // カラーパレット
  if (summary.colors.size > 0) {
    md += `## Color Palette\n\n`;
    const colors = Array.from(summary.colors).slice(0, 20);
    md += '```\n';
    colors.forEach(color => md += `${color}\n`);
    if (summary.colors.size > 20) {
      md += `... and ${summary.colors.size - 20} more\n`;
    }
    md += '```\n\n';
  }

  // インポート
  if (summary.imports.length > 0) {
    md += `## Imports\n\n`;
    summary.imports.forEach(imp => {
      md += `- \`@import ${imp}\`\n`;
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
    console.error('Error: CSS file not specified');
    console.error('Usage: npx ts-node src/summarize-css.ts <css-file>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File "${filePath}" does not exist`);
    process.exit(1);
  }

  const validExtensions = ['.css', '.scss', '.sass', '.less'];
  const hasValidExtension = validExtensions.some(ext => filePath.endsWith(ext));

  if (!hasValidExtension) {
    console.error(`Error: "${filePath}" is not a valid CSS file`);
    process.exit(1);
  }

  try {
    console.log(`\n=== Analyzing: ${filePath} ===\n`);

    const summary = analyzeCss(filePath);
    const markdown = generateMarkdown(summary);

    // コンソールに出力
    console.log(markdown);

    // outputディレクトリに保存
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(outputDir, `${baseName}-summary.md`);

    fs.writeFileSync(outputPath, markdown);

    console.log(`\n=== Summary saved to: ${outputPath} ===`);
  } catch (error) {
    console.error('Error analyzing CSS file:', error);
    process.exit(1);
  }
}

main();
