#!/usr/bin/env ts-node

/**
 * detect-circular-deps.ts
 * 循環依存を検出して警告
 *
 * Usage: npx ts-node src/detect-circular-deps.ts <project-dir>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';

// ==================== Interfaces ====================

interface CircularDependency {
  cycle: string[];
  severity: 'error' | 'warning';
  type: 'module' | 'service' | 'component' | 'general';
}

interface DependencyNode {
  file: string;
  imports: string[];
}

// ==================== Circular Dependency Detector ====================

class CircularDependencyDetector {
  private projectPath: string;
  private graph = new Map<string, DependencyNode>();
  private circularDeps: CircularDependency[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  detect(): CircularDependency[] {
    console.log(`Detecting circular dependencies in: ${this.projectPath}\n`);

    // 依存関係グラフを構築
    this.buildGraph();

    // 強連結成分を検出
    this.findStronglyConnectedComponents();

    return this.circularDeps;
  }

  private buildGraph(): void {
    const files = this.getAllTypeScriptFiles(this.projectPath);
    console.log(`Analyzing ${files.length} files...\n`);

    for (const file of files) {
      const imports = this.extractImports(file);
      this.graph.set(file, {
        file,
        imports
      });
    }
  }

  private getAllTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];
    // Resolve to absolute path
    const absDir = path.resolve(dir);

    const traverse = (currentPath: string): void => {
      try {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
          const fullPath = path.join(currentPath, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            if (!item.startsWith('.') && item !== 'node_modules' && item !== 'dist') {
              traverse(fullPath);
            }
          } else if (stat.isFile() && item.endsWith('.ts') && !item.endsWith('.spec.ts')) {
            // Store absolute paths
            files.push(path.resolve(fullPath));
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${currentPath}:`, error);
      }
    };

    traverse(absDir);
    return files;
  }

  private extractImports(filePath: string): string[] {
    const imports: string[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: false
      });

      const traverse = (node: any): void => {
        if (!node) return;

        if (node.type === 'ImportDeclaration') {
          const source = node.source.value;

          // 相対パスのみ解析
          if (source.startsWith('.')) {
            const dir = path.dirname(filePath);
            let resolvedPath = path.resolve(dir, source);

            if (!resolvedPath.endsWith('.ts')) {
              if (fs.existsSync(resolvedPath + '.ts')) {
                resolvedPath += '.ts';
              } else if (fs.existsSync(path.join(resolvedPath, 'index.ts'))) {
                resolvedPath = path.join(resolvedPath, 'index.ts');
              }
            }

            if (fs.existsSync(resolvedPath)) {
              imports.push(resolvedPath);
            }
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
      // Parse error は無視
    }

    return imports;
  }

  private findStronglyConnectedComponents(): void {
    // Tarjanのアルゴリズムで強連結成分を検出
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Map<string, boolean>();
    const stack: string[] = [];
    let indexCounter = 0;

    const strongConnect = (v: string): void => {
      index.set(v, indexCounter);
      lowlink.set(v, indexCounter);
      indexCounter++;
      stack.push(v);
      onStack.set(v, true);

      const node = this.graph.get(v);
      if (node) {
        for (const w of node.imports) {
          if (!index.has(w)) {
            strongConnect(w);
            lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
          } else if (onStack.get(w)) {
            lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
          }
        }
      }

      // ルートノードの場合、強連結成分を出力
      if (lowlink.get(v) === index.get(v)) {
        const component: string[] = [];
        let w: string;

        do {
          w = stack.pop()!;
          onStack.set(w, false);
          component.push(w);
        } while (w !== v);

        // サイズ > 1 の場合、循環依存
        if (component.length > 1) {
          this.addCircularDependency(component);
        }
      }
    };

    for (const [file] of this.graph) {
      if (!index.has(file)) {
        strongConnect(file);
      }
    }
  }

  private addCircularDependency(cycle: string[]): void {
    const relativeCycle = cycle.map(f => path.relative(this.projectPath, f));

    // サイクルの種別を判定
    let type: CircularDependency['type'] = 'general';
    let severity: CircularDependency['severity'] = 'warning';

    const hasModule = cycle.some(f => f.includes('.module.'));
    const hasService = cycle.some(f => f.includes('.service.'));
    const hasComponent = cycle.some(f => f.includes('.component.'));

    if (hasModule) {
      type = 'module';
      severity = 'error'; // モジュール循環は深刻
    } else if (hasService) {
      type = 'service';
      severity = 'error'; // サービス循環も深刻
    } else if (hasComponent) {
      type = 'component';
      severity = 'warning';
    }

    this.circularDeps.push({
      cycle: relativeCycle,
      severity,
      type
    });
  }
}

// ==================== Output Formatters ====================

function formatMarkdown(cycles: CircularDependency[]): string {
  let md = `# Circular Dependency Report\n\n`;

  md += `**Analyzed At**: ${new Date().toISOString()}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Total Circular Dependencies**: ${cycles.length}\n`;
  md += `- **Errors**: ${cycles.filter(c => c.severity === 'error').length}\n`;
  md += `- **Warnings**: ${cycles.filter(c => c.severity === 'warning').length}\n\n`;

  const byType = new Map<string, number>();
  cycles.forEach(c => {
    byType.set(c.type, (byType.get(c.type) || 0) + 1);
  });

  md += `### By Type\n\n`;
  byType.forEach((count, type) => {
    md += `- **${type}**: ${count}\n`;
  });
  md += `\n`;

  if (cycles.length === 0) {
    md += `✅ **No circular dependencies detected!**\n`;
    return md;
  }

  md += `## Detected Cycles\n\n`;

  cycles.forEach((cycle, index) => {
    const icon = cycle.severity === 'error' ? '🔴' : '🟡';
    const severityLabel = cycle.severity.toUpperCase();

    md += `### ${icon} ${severityLabel} #${index + 1}: ${cycle.type} Circular Dependency\n\n`;

    md += '```\n';
    cycle.cycle.forEach((file, i) => {
      md += `${i + 1}. ${file}\n`;
    });
    md += `   ↺ back to ${cycle.cycle[0]}\n`;
    md += '```\n\n';
  });

  return md;
}

function formatConsole(cycles: CircularDependency[]): void {
  if (cycles.length === 0) {
    console.log('✅ No circular dependencies detected!\n');
    return;
  }

  console.log(`Found ${cycles.length} circular dependencies:\n`);

  const errors = cycles.filter(c => c.severity === 'error');
  const warnings = cycles.filter(c => c.severity === 'warning');

  if (errors.length > 0) {
    console.log(`🔴 ERRORS (${errors.length}):\n`);
    errors.forEach((cycle, index) => {
      console.log(`  ${index + 1}. ${cycle.type.toUpperCase()} Cycle:`);
      console.log(`     ${cycle.cycle.join(' → ')}`);
      console.log(`     ↺ ${cycle.cycle[0]}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log(`🟡 WARNINGS (${warnings.length}):\n`);
    warnings.forEach((cycle, index) => {
      console.log(`  ${index + 1}. ${cycle.type.toUpperCase()} Cycle:`);
      console.log(`     ${cycle.cycle.join(' → ')}`);
      console.log(`     ↺ ${cycle.cycle[0]}\n`);
    });
  }
}

// ==================== Main ====================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npx ts-node src/detect-circular-deps.ts <project-dir> [options]

Options:
  --save <path>      Save output to file
  --help             Show this help message

Examples:
  npx ts-node src/detect-circular-deps.ts ./my-project
  npx ts-node src/detect-circular-deps.ts ./my-project --save circular-deps.md
`);
    process.exit(0);
  }

  const projectPath = args[0];
  const savePath = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;

  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Project directory "${projectPath}" does not exist`);
    process.exit(1);
  }

  const detector = new CircularDependencyDetector(projectPath);
  const cycles = detector.detect();

  formatConsole(cycles);

  if (savePath) {
    const markdown = formatMarkdown(cycles);
    fs.writeFileSync(savePath, markdown);
    console.log(`✓ Saved to ${savePath}\n`);
  }

  // エラーがある場合は終了コード1を返す
  const hasErrors = cycles.some(c => c.severity === 'error');
  if (hasErrors) {
    process.exit(1);
  }
}

main();
