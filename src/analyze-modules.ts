#!/usr/bin/env ts-node

/**
 * analyze-modules.ts
 * NgModuleの構造と依存関係を解析
 *
 * Usage: npx ts-node src/analyze-modules.ts <project-dir>
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';

// ==================== Interfaces ====================

interface ModuleAnalysis {
  name: string;
  path: string;
  type: 'root' | 'feature' | 'shared' | 'core' | 'unknown';
  imports: ModuleReference[];
  exports: ModuleReference[];
  declarations: ComponentReference[];
  providers: ServiceReference[];
  isLazy: boolean;
  lazyRoute?: string;
}

interface ModuleReference {
  name: string;
  path?: string;
  external: boolean;
}

interface ComponentReference {
  name: string;
}

interface ServiceReference {
  name: string;
}

interface ModuleGraph {
  modules: ModuleAnalysis[];
  dependencies: ModuleDependency[];
}

interface ModuleDependency {
  from: string;
  to: string;
  type: 'imports' | 'exports';
}

// ==================== Module Analyzer ====================

class ModuleAnalyzer {
  private projectPath: string;
  private modules: ModuleAnalysis[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  analyze(): ModuleGraph {
    console.log(`Analyzing modules in: ${this.projectPath}\n`);

    const moduleFiles = this.findModuleFiles(this.projectPath);
    console.log(`Found ${moduleFiles.length} module files\n`);

    for (const file of moduleFiles) {
      try {
        const module = this.analyzeModuleFile(file);
        if (module) {
          this.modules.push(module);
          console.log(`✓ Analyzed: ${module.name} (${module.type})`);
        }
      } catch (error) {
        console.error(`✗ Failed to analyze ${file}:`, error);
      }
    }

    const dependencies = this.buildDependencies();

    return {
      modules: this.modules,
      dependencies
    };
  }

  private findModuleFiles(dir: string): string[] {
    const files: string[] = [];

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
          } else if (stat.isFile() && item.endsWith('.module.ts') && !item.endsWith('.spec.ts')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${currentPath}:`, error);
      }
    };

    traverse(dir);
    return files;
  }

  private analyzeModuleFile(filePath: string): ModuleAnalysis | null {
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: false
      });

      let moduleName: string | null = null;
      let ngModuleMetadata: any = null;

      // クラス名とデコレータを探す
      const traverse = (node: any): void => {
        if (!node) return;

        if (node.type === 'ClassDeclaration' && node.id) {
          moduleName = node.id.name;

          if (node.decorators && Array.isArray(node.decorators)) {
            for (const decorator of node.decorators) {
              if (decorator.expression?.callee?.name === 'NgModule') {
                if (decorator.expression.arguments && decorator.expression.arguments[0]) {
                  ngModuleMetadata = decorator.expression.arguments[0];
                }
              }
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

      if (!moduleName || !ngModuleMetadata) {
        return null;
      }

      // メタデータからプロパティを抽出
      const imports = this.extractArrayProperty(ngModuleMetadata, 'imports');
      const exports = this.extractArrayProperty(ngModuleMetadata, 'exports');
      const declarations = this.extractArrayProperty(ngModuleMetadata, 'declarations');
      const providers = this.extractArrayProperty(ngModuleMetadata, 'providers');

      const type = this.inferModuleType(filePath, moduleName);
      const isLazy = this.checkIfLazy(filePath);

      return {
        name: moduleName,
        path: path.relative(this.projectPath, filePath),
        type,
        imports: imports.map(name => ({ name, external: this.isExternalModule(name) })),
        exports: exports.map(name => ({ name, external: false })),
        declarations: declarations.map(name => ({ name })),
        providers: providers.map(name => ({ name })),
        isLazy,
        lazyRoute: isLazy ? this.findLazyRoute(filePath) : undefined
      };
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error);
      return null;
    }
  }

  private extractArrayProperty(metadata: any, propertyName: string): string[] {
    if (!metadata || metadata.type !== 'ObjectExpression') {
      return [];
    }

    for (const prop of metadata.properties) {
      if (prop.type === 'Property' && prop.key.name === propertyName) {
        if (prop.value.type === 'ArrayExpression') {
          return prop.value.elements
            .filter((el: any) => el && el.type === 'Identifier')
            .map((el: any) => el.name);
        }
      }
    }

    return [];
  }

  private inferModuleType(filePath: string, moduleName: string): ModuleAnalysis['type'] {
    const fileName = filePath.toLowerCase();
    const name = moduleName.toLowerCase();

    if (fileName.includes('app.module') || name.includes('appmodule')) {
      return 'root';
    }
    if (fileName.includes('core') || name.includes('core')) {
      return 'core';
    }
    if (fileName.includes('shared') || name.includes('shared')) {
      return 'shared';
    }
    if (fileName.includes('feature') || name.includes('feature')) {
      return 'feature';
    }

    return 'unknown';
  }

  private isExternalModule(moduleName: string): boolean {
    // Angular標準モジュールや外部ライブラリかどうか
    return moduleName.includes('Module') &&
           (moduleName.startsWith('Common') ||
            moduleName.startsWith('Http') ||
            moduleName.startsWith('Forms') ||
            moduleName.startsWith('Router') ||
            moduleName.startsWith('Browser'));
  }

  private checkIfLazy(filePath: string): boolean {
    // Lazy loadingの判定は簡易版（routes.tsを見る必要がある）
    return filePath.includes('feature') || filePath.includes('lazy');
  }

  private findLazyRoute(_filePath: string): string | undefined {
    // TODO: routes.tsからlazy routeを検索
    return undefined;
  }

  private buildDependencies(): ModuleDependency[] {
    const dependencies: ModuleDependency[] = [];

    for (const module of this.modules) {
      // importsの依存関係
      for (const imp of module.imports) {
        if (!imp.external) {
          dependencies.push({
            from: module.name,
            to: imp.name,
            type: 'imports'
          });
        }
      }

      // exportsの依存関係
      for (const exp of module.exports) {
        dependencies.push({
          from: module.name,
          to: exp.name,
          type: 'exports'
        });
      }
    }

    return dependencies;
  }
}

// ==================== Output Formatters ====================

function generateMermaidGraph(graph: ModuleGraph): string {
  let mermaid = 'graph TD\n\n';

  // スタイル定義
  mermaid += '  classDef root fill:#f9f,stroke:#333,stroke-width:4px\n';
  mermaid += '  classDef core fill:#bbf,stroke:#333,stroke-width:2px\n';
  mermaid += '  classDef shared fill:#bfb,stroke:#333,stroke-width:2px\n';
  mermaid += '  classDef feature fill:#ffb,stroke:#333,stroke-width:2px\n';
  mermaid += '  classDef lazy fill:#fbb,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5\n\n';

  // ノード
  graph.modules.forEach((module, index) => {
    const nodeId = `M${index + 1}`;
    const label = module.isLazy ? `${module.name}\\n[LAZY]` : module.name;
    mermaid += `  ${nodeId}["${label}"]\n`;

    // スタイルクラスを適用
    if (module.isLazy) {
      mermaid += `  class ${nodeId} lazy\n`;
    } else {
      mermaid += `  class ${nodeId} ${module.type}\n`;
    }
  });

  mermaid += '\n';

  // エッジ
  const moduleMap = new Map(graph.modules.map((m, i) => [m.name, `M${i + 1}`]));

  graph.dependencies.forEach(dep => {
    const fromId = moduleMap.get(dep.from);
    const toId = moduleMap.get(dep.to);

    if (fromId && toId) {
      mermaid += `  ${fromId} --> ${toId}\n`;
    }
  });

  return mermaid;
}

function formatMarkdown(graph: ModuleGraph): string {
  let md = `# Module Analysis Report\n\n`;

  md += `**Analyzed At**: ${new Date().toISOString()}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Total Modules**: ${graph.modules.length}\n`;
  md += `- **Root Modules**: ${graph.modules.filter(m => m.type === 'root').length}\n`;
  md += `- **Core Modules**: ${graph.modules.filter(m => m.type === 'core').length}\n`;
  md += `- **Shared Modules**: ${graph.modules.filter(m => m.type === 'shared').length}\n`;
  md += `- **Feature Modules**: ${graph.modules.filter(m => m.type === 'feature').length}\n`;
  md += `- **Lazy Modules**: ${graph.modules.filter(m => m.isLazy).length}\n\n`;

  md += `## Modules\n\n`;

  for (const module of graph.modules) {
    md += `### ${module.name} (${module.type})\n\n`;
    md += `- **Path**: ${module.path}\n`;
    md += `- **Lazy**: ${module.isLazy ? 'Yes' : 'No'}\n`;

    if (module.imports.length > 0) {
      md += `- **Imports**: ${module.imports.map(i => i.name).join(', ')}\n`;
    }

    if (module.exports.length > 0) {
      md += `- **Exports**: ${module.exports.map(e => e.name).join(', ')}\n`;
    }

    if (module.declarations.length > 0) {
      md += `- **Declarations**: ${module.declarations.map(d => d.name).join(', ')}\n`;
    }

    if (module.providers.length > 0) {
      md += `- **Providers**: ${module.providers.map(p => p.name).join(', ')}\n`;
    }

    md += `\n`;
  }

  md += `## Dependency Graph (Mermaid)\n\n`;
  md += '```mermaid\n';
  md += generateMermaidGraph(graph);
  md += '```\n';

  return md;
}

// ==================== Main ====================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: npx ts-node src/analyze-modules.ts <project-dir> [options]

Options:
  --output <format>  Output format: md, mermaid (default: md)
  --save <path>      Save output to file
  --help             Show this help message

Examples:
  npx ts-node src/analyze-modules.ts ./my-project
  npx ts-node src/analyze-modules.ts ./my-project --output mermaid
  npx ts-node src/analyze-modules.ts ./my-project --save modules.md
`);
    process.exit(0);
  }

  const projectPath = args[0];
  const outputFormat = args.includes('--output') ? args[args.indexOf('--output') + 1] : 'md';
  const savePath = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;

  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Project directory "${projectPath}" does not exist`);
    process.exit(1);
  }

  const analyzer = new ModuleAnalyzer(projectPath);
  const graph = analyzer.analyze();

  console.log(`\n✓ Found ${graph.modules.length} modules\n`);

  // Format output
  let output: string;
  if (outputFormat === 'mermaid') {
    output = generateMermaidGraph(graph);
  } else {
    output = formatMarkdown(graph);
  }

  // Save or print
  if (savePath) {
    fs.writeFileSync(savePath, output);
    console.log(`✓ Saved to ${savePath}`);
  } else {
    console.log(output);
  }
}

main();
