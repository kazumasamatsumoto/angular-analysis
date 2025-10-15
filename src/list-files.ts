#!/usr/bin/env ts-node

/**
 * list-files.ts
 * 指定ディレクトリ配下の.html/.css/.tsファイルをリストアップ
 *
 * Usage: npx ts-node src/list-files.ts <target-dir>
 */

import * as fs from 'fs';
import * as path from 'path';

interface FileList {
  html: string[];
  css: string[];
  ts: string[];
}

function listFiles(dir: string): FileList {
  const result: FileList = {
    html: [],
    css: [],
    ts: []
  };

  function traverse(currentPath: string): void {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // node_modules, dist, .angular などは除外
          if (!item.startsWith('.') && item !== 'node_modules' && item !== 'dist' && item !== 'coverage') {
            traverse(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (ext === '.html') {
            result.html.push(fullPath);
          } else if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') {
            result.css.push(fullPath);
          } else if (ext === '.ts') {
            result.ts.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error);
    }
  }

  traverse(dir);
  return result;
}

function main(): void {
  const targetDir = process.argv[2];

  if (!targetDir) {
    console.error('Error: Target directory not specified');
    console.error('Usage: npx ts-node src/list-files.ts <target-dir>');
    process.exit(1);
  }

  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory "${targetDir}" does not exist`);
    process.exit(1);
  }

  if (!fs.statSync(targetDir).isDirectory()) {
    console.error(`Error: "${targetDir}" is not a directory`);
    process.exit(1);
  }

  const files = listFiles(targetDir);

  console.log(JSON.stringify(files, null, 2));
  console.log('\n=== Summary ===');
  console.log(`HTML files: ${files.html.length}`);
  console.log(`CSS files: ${files.css.length}`);
  console.log(`TypeScript files: ${files.ts.length}`);
  console.log(`Total: ${files.html.length + files.css.length + files.ts.length}`);
}

main();
