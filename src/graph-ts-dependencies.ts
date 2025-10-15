#!/usr/bin/env ts-node

/**
 * graph-ts-dependencies.ts
 * プロジェクト全体のimport/export関係をグラフ化
 *
 * Usage: npx ts-node src/graph-ts-dependencies.ts <project-dir>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';

interface DependencyNode {
  file: string;
  imports: string[];
  exports: string[];
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Array<{ from: string; to: string; type: string }>;
}

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentPath: string): void {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (!item.startsWith('.') && item !== 'node_modules' && item !== 'dist' && item !== 'coverage') {
            traverse(fullPath);
          }
        } else if (stat.isFile() && item.endsWith('.ts') && !item.endsWith('.spec.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error);
    }
  }

  traverse(dir);
  return files;
}

function analyzeFile(filePath: string, baseDir: string): DependencyNode {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports: string[] = [];
  const exports: string[] = [];

  try {
    const ast = parse(content, {
      loc: true,
      range: true,
      comment: false
    });

    ast.body.forEach((node: any) => {
      if (node.type === 'ImportDeclaration') {
        const source = node.source.value;

        // 相対パスの場合は絶対パスに変換
        if (source.startsWith('.')) {
          const dir = path.dirname(filePath);
          let resolvedPath = path.resolve(dir, source);

          // .ts拡張子を追加（存在しない場合）
          if (!resolvedPath.endsWith('.ts')) {
            if (fs.existsSync(resolvedPath + '.ts')) {
              resolvedPath += '.ts';
            } else if (fs.existsSync(path.join(resolvedPath, 'index.ts'))) {
              resolvedPath = path.join(resolvedPath, 'index.ts');
            }
          }

          imports.push(resolvedPath);
        } else {
          // 外部パッケージの場合はそのまま記録
          imports.push(source);
        }
      }

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
    });
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
  }

  return {
    file: path.relative(baseDir, filePath),
    imports,
    exports
  };
}

function buildGraph(projectDir: string): DependencyGraph {
  const files = getAllTsFiles(projectDir);
  const nodes = new Map<string, DependencyNode>();
  const edges: Array<{ from: string; to: string; type: string }> = [];

  console.log(`Found ${files.length} TypeScript files...`);

  files.forEach(file => {
    const node = analyzeFile(file, projectDir);
    nodes.set(file, node);
  });

  // エッジを構築
  nodes.forEach((node) => {
    node.imports.forEach(importPath => {
      const isExternal = !importPath.startsWith('/') && !importPath.startsWith('.');

      if (!isExternal) {
        edges.push({
          from: node.file,
          to: path.relative(projectDir, importPath),
          type: 'import'
        });
      } else {
        edges.push({
          from: node.file,
          to: importPath,
          type: 'external'
        });
      }
    });
  });

  return { nodes, edges };
}

function generateMermaidGraph(graph: DependencyGraph): string {
  let mermaid = 'graph TD\n';

  // ファイル名を短縮してIDを生成
  const fileToId = new Map<string, string>();
  let idCounter = 1;

  graph.nodes.forEach((node) => {
    const id = `N${idCounter++}`;
    fileToId.set(node.file, id);
    const fileName = path.basename(node.file);
    mermaid += `  ${id}["${fileName}"]\n`;
  });

  // エッジを追加
  const internalEdges = graph.edges.filter(e => e.type === 'import');

  internalEdges.forEach(edge => {
    const fromId = fileToId.get(edge.from);
    const toId = fileToId.get(edge.to);

    if (fromId && toId) {
      mermaid += `  ${fromId} --> ${toId}\n`;
    }
  });

  return mermaid;
}

function generateDOTGraph(graph: DependencyGraph): string {
  let dot = 'digraph Dependencies {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style=rounded];\n\n';

  // ファイル名を短縮してIDを生成
  const fileToId = new Map<string, string>();
  let idCounter = 1;

  graph.nodes.forEach((node) => {
    const id = `N${idCounter++}`;
    fileToId.set(node.file, id);
    const fileName = path.basename(node.file);
    dot += `  ${id} [label="${fileName}"];\n`;
  });

  dot += '\n';

  // エッジを追加
  const internalEdges = graph.edges.filter(e => e.type === 'import');

  internalEdges.forEach(edge => {
    const fromId = fileToId.get(edge.from);
    const toId = fileToId.get(edge.to);

    if (fromId && toId) {
      dot += `  ${fromId} -> ${toId};\n`;
    }
  });

  dot += '}\n';

  return dot;
}

function main(): void {
  const projectDir = process.argv[2];

  if (!projectDir) {
    console.error('Error: Project directory not specified');
    console.error('Usage: npx ts-node src/graph-ts-dependencies.ts <project-dir>');
    process.exit(1);
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`Error: Directory "${projectDir}" does not exist`);
    process.exit(1);
  }

  if (!fs.statSync(projectDir).isDirectory()) {
    console.error(`Error: "${projectDir}" is not a directory`);
    process.exit(1);
  }

  try {
    console.log(`\n=== Analyzing dependencies in: ${projectDir} ===\n`);

    const graph = buildGraph(projectDir);

    console.log('\n=== Dependency Statistics ===');
    console.log(`Total files: ${graph.nodes.size}`);
    console.log(`Total dependencies: ${graph.edges.length}`);

    const externalDeps = graph.edges.filter(e => e.type === 'external');
    const internalDeps = graph.edges.filter(e => e.type === 'import');

    console.log(`Internal dependencies: ${internalDeps.length}`);
    console.log(`External dependencies: ${externalDeps.length}`);

    // 外部依存関係の一覧
    if (externalDeps.length > 0) {
      const uniqueExternal = new Set(externalDeps.map(e => e.to));
      console.log('\n=== External Packages ===');
      uniqueExternal.forEach(pkg => console.log(`  - ${pkg}`));
    }

    // Mermaid形式で出力
    console.log('\n=== Mermaid Graph ===\n');
    const mermaid = generateMermaidGraph(graph);
    console.log(mermaid);

    // DOT形式で出力
    console.log('\n=== DOT Graph (Graphviz) ===\n');
    const dot = generateDOTGraph(graph);
    console.log(dot);

    // outputディレクトリに保存
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const mermaidPath = path.join(outputDir, 'dependencies.mmd');
    const dotPath = path.join(outputDir, 'dependencies.dot');

    fs.writeFileSync(mermaidPath, mermaid);
    fs.writeFileSync(dotPath, dot);

    console.log(`\n=== Files saved ===`);
    console.log(`Mermaid: ${mermaidPath}`);
    console.log(`DOT: ${dotPath}`);
  } catch (error) {
    console.error('Error analyzing dependencies:', error);
    process.exit(1);
  }
}

main();
