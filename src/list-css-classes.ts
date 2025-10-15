#!/usr/bin/env ts-node

/**
 * list-css-classes.ts
 * CSSファイルからクラスセレクタを抽出
 *
 * Usage: npx ts-node src/list-css-classes.ts <css-file>
 */

import * as fs from 'fs';
import * as csstree from 'css-tree';

interface CSSClass {
  className: string;
  line: number;
  selector: string;
}

function extractClasses(filePath: string): CSSClass[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const classes: CSSClass[] = [];

  try {
    const ast = csstree.parse(content, {
      positions: true,
      parseAtrulePrelude: false,
      parseCustomProperty: false
    });

    csstree.walk(ast, {
      visit: 'Rule',
      enter(node: any) {
        if (node.prelude && node.prelude.type === 'SelectorList') {
          const selectorText = csstree.generate(node.prelude);

          // クラスセレクタを抽出（.で始まるもの）
          const classMatches = selectorText.match(/\.[\w-]+/g);

          if (classMatches) {
            const line = node.loc ? node.loc.start.line : 0;

            classMatches.forEach(match => {
              const className = match.substring(1); // . を除去
              classes.push({
                className,
                line,
                selector: selectorText
              });
            });
          }
        }
      }
    });
  } catch (error) {
    console.error('Error parsing CSS:', error);
  }

  return classes;
}

function displayTable(classes: CSSClass[]): void {
  if (classes.length === 0) {
    console.log('No CSS classes found.');
    return;
  }

  // 重複を排除してユニークなクラス名を取得
  const uniqueClasses = Array.from(
    new Map(classes.map(c => [c.className, c])).values()
  );

  console.log('\n=== CSS Classes ===\n');
  console.log('┌─────┬──────────────────────────────┬─────────────────────────────────────────────────┐');
  console.log('│ Line│ Class Name                   │ Full Selector                                   │');
  console.log('├─────┼──────────────────────────────┼─────────────────────────────────────────────────┤');

  uniqueClasses.forEach(cls => {
    const line = cls.line.toString().padEnd(4);
    const className = cls.className.padEnd(28);
    const selector = cls.selector.length > 48 ? cls.selector.substring(0, 45) + '...' : cls.selector.padEnd(48);
    console.log(`│ ${line}│ ${className} │ ${selector} │`);
  });

  console.log('└─────┴──────────────────────────────┴─────────────────────────────────────────────────┘');
}

function main(): void {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Error: CSS file not specified');
    console.error('Usage: npx ts-node src/list-css-classes.ts <css-file>');
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
    const classes = extractClasses(filePath);

    console.log(`\n=== Analyzing: ${filePath} ===`);
    displayTable(classes);

    // 統計情報
    const uniqueCount = new Set(classes.map(c => c.className)).size;
    console.log(`\n=== Statistics ===`);
    console.log(`Total class usages: ${classes.length}`);
    console.log(`Unique classes: ${uniqueCount}`);

    // JSON出力
    console.log('\n=== JSON Output ===');
    console.log(JSON.stringify(classes, null, 2));
  } catch (error) {
    console.error('Error analyzing CSS file:', error);
    process.exit(1);
  }
}

main();
